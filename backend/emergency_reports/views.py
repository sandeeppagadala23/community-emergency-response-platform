
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Q
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.shortcuts import get_object_or_404

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from users.guardian import (
    get_user_profile,
    get_linked_resident_ids,
    get_guardians_for_resident,
    is_guardian,
)

from users.models import UserProfile
from .models import EmergencyReport, EmergencyReportEvent
from .serializers import (
    EmergencyReportSerializer,
    EmergencyReportStatusSerializer,
    EmergencyReportEventSerializer,
)
from .services import (
    create_report_notifications,
    report_creation_recipients,
)


def can_view_all_reports(user):
    if user.is_staff or user.is_superuser:
        return True

    profile = get_user_profile(user)

    return (
        profile is not None
        and profile.is_verified
        and profile.role == 'security'
    )


def reports_visible_to(user):
    reports = EmergencyReport.objects.select_related(
        'reporter',
        'responded_by',
        'assigned_volunteer',
        'society',
    ).prefetch_related(
        'reporter__flats__block',
    )
    if can_view_all_reports(user):
        return reports
    profile = get_user_profile(user)
    if profile is not None and profile.is_verified and profile.role == 'volunteer':
        return reports.filter(
            Q(reporter=user) | Q(assigned_volunteer=user)
        ).distinct()
    if is_guardian(user):
        linked_resident_ids = get_linked_resident_ids(user)
        return reports.filter(
            Q(reporter=user) | Q(reporter_id__in=linked_resident_ids)
        ).distinct()
    return reports.filter(reporter=user)


def can_manage_report_status(user, report):
    if user.is_staff or user.is_superuser:
        return True
    profile = get_user_profile(user)
    if profile is None or not profile.is_verified:
        return False
    if profile.role == 'security':
        return True
    return profile.role == 'volunteer' and report.assigned_volunteer_id == user.pk


def create_report_history(report, actor, event_type, from_status='', to_status='', details=''):
    return EmergencyReportEvent.objects.create(
        report=report,
        actor=actor,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        details=details,
    )


def notify_reporter_status(report, actor, new_status):
    recipients = {report.reporter}
    recipients.update(get_guardians_for_resident(report.reporter))
    recipients.discard(actor)
    if not recipients:
        return
    create_report_notifications(
        report,
        list(recipients),
        f'REPORT_STATUS_{new_status}',
        'Report status updated',
        f'{report.title or report.get_incident_type_display()} is now {report.get_status_display()}.',
    )


def is_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    profile = get_user_profile(user)
    return profile is not None and getattr(profile, 'role', '').lower() == 'admin'


def available_volunteer_profiles(report=None):
    active_assignment = EmergencyReport.objects.filter(
        assigned_volunteer_id=OuterRef('user_id'),
        status__in=['PENDING', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS'],
    )
    profiles = UserProfile.objects.filter(
        role='volunteer',
        is_verified=True,
        user__is_active=True,
    ).annotate(
        has_active_assignment=Exists(active_assignment),
    )
    if report is not None and report.assigned_volunteer_id:
        profiles = profiles.filter(
            Q(has_active_assignment=False)
            | Q(user_id=report.assigned_volunteer_id)
        )
    else:
        profiles = profiles.filter(has_active_assignment=False)
    return profiles.select_related('user').order_by('user__username')


@login_required(login_url='login')
def create_report_view(request):
    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        incident_type = request.POST.get('incident_type', '')
        location = request.POST.get('location', '').strip()
        description = request.POST.get('description', '').strip()

        valid_types = dict(EmergencyReport.INCIDENT_CHOICES)

        if (
            incident_type not in valid_types
            or not title
            or not location
            or not description
        ):
            messages.error(
                request,
                'Please complete all fields correctly.'
            )
        else:
            with transaction.atomic():
                report = EmergencyReport.objects.create(
                    reporter=request.user,
                    title=title,
                    incident_type=incident_type,
                    location=location,
                    description=description,
                )
                create_report_history(
                    report,
                    request.user,
                    'CREATED',
                    to_status=report.status,
                    details='Emergency report submitted.',
                )
                responders = report_creation_recipients(request.user.pk)
                create_report_notifications(
                    report,
                    responders,
                    'REPORT_CREATED',
                    'New emergency report',
                    f'{report.title} was reported at {report.location}.',
                )

            messages.success(
                request,
                'Emergency report submitted successfully!'
            )
            return redirect('emergency_reports:create_report')

    return render(
        request,
        'emergency_reports/create_report.html'
    )


@login_required(login_url='login')
def my_reports_view(request):
    reports = EmergencyReport.objects.filter(
        reporter=request.user
    ).order_by('-created_at')

    return render(
        request,
        'emergency_reports/my_reports.html',
        {'reports': reports},
    )


class EmergencyReportListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = EmergencyReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = reports_visible_to(self.request.user)

        category = self.request.query_params.get('category', '').strip().upper()
        if category:
            if category not in dict(EmergencyReport.INCIDENT_CHOICES):
                raise ValidationError({'category': 'Choose a valid report category.'})
            queryset = queryset.filter(incident_type=category)

        report_status = self.request.query_params.get('status', '').strip().upper()
        if report_status:
            if report_status not in dict(EmergencyReport.STATUS_CHOICES):
                raise ValidationError({'status': 'Choose a valid report status.'})
            queryset = queryset.filter(status=report_status)

        search = (
            self.request.query_params.get('search')
            or self.request.query_params.get('q', '')
        ).strip()
        if search:
            queryset = queryset.filter(
                Q(location__icontains=search)
                | Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(incident_type__icontains=search)
                | Q(reporter__username__icontains=search)
            )

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        responders = set(report_creation_recipients(self.request.user.pk))
        responders.update(get_guardians_for_resident(self.request.user))
        responders.discard(self.request.user)
        with transaction.atomic():
            report = serializer.save(reporter=self.request.user)
            create_report_history(
                report,
                self.request.user,
                'CREATED',
                to_status=report.status,
                details='Emergency report submitted.',
            )
            create_report_notifications(
                report,
                list(responders),
                'REPORT_CREATED',
                'New emergency report',
                f'{report.title} was reported at {report.location}.',
            )


class EmergencyReportDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = EmergencyReportSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        return reports_visible_to(self.request.user)

    def perform_update(self, serializer):
        user = self.request.user
        report = serializer.instance
        if not (user.is_staff or user.is_superuser or report.reporter_id == user.pk):
            raise PermissionDenied("You do not have permission to edit this report.")
        serializer.save()


class EmergencyReportStatusUpdateAPIView(generics.UpdateAPIView):
    serializer_class = EmergencyReportStatusSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['patch', 'put', 'head', 'options']

    def get_queryset(self):
        return reports_visible_to(self.request.user)

    def perform_update(self, serializer):
        report = serializer.instance
        previous_status = report.status
        next_status = serializer.validated_data.get('status', previous_status)
        if not can_manage_report_status(self.request.user, report):
            raise PermissionDenied(
                'Only administrators, security personnel, or the assigned volunteer can update this report.'
            )
        if next_status == 'ASSIGNED':
            raise ValidationError(
                {'status': 'Use the administrator assignment endpoint to set Assigned status.'}
            )
        if next_status != previous_status:
            next_allowed = {
                'PENDING': {'ACKNOWLEDGED', 'IN_PROGRESS'},
                'ACKNOWLEDGED': {'IN_PROGRESS'},
                'ASSIGNED': {'IN_PROGRESS'},
                'IN_PROGRESS': {'RESOLVED'},
                'RESOLVED': {'CLOSED'},
                'CLOSED': set(),
            }
            if next_status not in next_allowed.get(previous_status, set()):
                raise ValidationError({
                    'status': f'Cannot change status from {previous_status} to {next_status}.',
                })
            profile = get_user_profile(self.request.user)
            if (
                profile is not None
                and profile.role == 'volunteer'
                and next_status not in {'IN_PROGRESS', 'RESOLVED'}
            ):
                raise PermissionDenied(
                    'Volunteers may only start or resolve their assigned reports.'
                )
        with transaction.atomic():
            updated_report = serializer.save(responded_by=self.request.user)
            if next_status != previous_status:
                create_report_history(
                    updated_report,
                    self.request.user,
                    'STATUS_CHANGED',
                    from_status=previous_status,
                    to_status=next_status,
                    details=f'Status changed to {updated_report.get_status_display()}.',
                )
                notify_reporter_status(
                    updated_report,
                    self.request.user,
                    next_status,
                )

    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def available_report_volunteers(request):
    if not is_admin(request.user):
        raise PermissionDenied('Only administrators can assign report volunteers.')
    return Response(
        [
            {
                'id': profile.user_id,
                'name': profile.user.get_full_name().strip() or profile.user.username,
                'username': profile.user.username,
            }
            for profile in available_volunteer_profiles()
        ],
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def assign_report_volunteer(request, pk):
    if not is_admin(request.user):
        raise PermissionDenied('Only administrators can assign report volunteers.')
    volunteer_id = request.data.get('volunteer_id')
    if isinstance(volunteer_id, bool):
        raise ValidationError({'volunteer_id': 'Select an available volunteer.'})
    try:
        volunteer_id = int(volunteer_id)
    except (TypeError, ValueError):
        raise ValidationError({'volunteer_id': 'Select an available volunteer.'})

    with transaction.atomic():
        report = get_object_or_404(
            EmergencyReport.objects.select_for_update(),
            pk=pk,
        )
        profile = get_object_or_404(
            available_volunteer_profiles(report),
            user_id=volunteer_id,
        )
        if report.reporter_id == volunteer_id:
            raise ValidationError({'volunteer_id': 'The reporter cannot be assigned to their own report.'})
        if report.status == 'CLOSED' or report.status == 'RESOLVED':
            raise ValidationError({'status': 'Resolved or closed reports cannot be assigned.'})
        if report.status not in {'ACKNOWLEDGED', 'ASSIGNED'}:
            raise ValidationError({
                'status': 'A report must be acknowledged before volunteer assignment.',
            })

        old_volunteer = report.assigned_volunteer
        if old_volunteer is not None and old_volunteer.pk == profile.user_id:
            return Response(
                EmergencyReportSerializer(report).data,
                status=status.HTTP_200_OK,
            )
        report.assigned_volunteer = profile.user
        previous_status = report.status
        report.status = 'ASSIGNED'
        report.save(update_fields=['assigned_volunteer', 'status', 'updated_at'])
        event_type = 'REASSIGNED' if old_volunteer else 'ASSIGNED'
        old_name = (
            old_volunteer.get_full_name().strip() or old_volunteer.username
            if old_volunteer
            else ''
        )
        new_name = profile.user.get_full_name().strip() or profile.user.username
        create_report_history(
            report,
            request.user,
            event_type,
            from_status=previous_status,
            to_status='ASSIGNED',
            details=(
                f'Assigned to {new_name}.'
                if not old_name
                else f'Reassigned from {old_name} to {new_name}.'
            ),
        )
        create_report_notifications(
            report,
            [profile.user],
            'REPORT_ASSIGNED',
            'Emergency report assigned',
            f'{report.title} at {report.location} has been assigned to you.',
        )
        if previous_status != 'ASSIGNED':
            notify_reporter_status(report, request.user, 'ASSIGNED')

    return Response(
        EmergencyReportSerializer(report).data,
        status=status.HTTP_201_CREATED if old_volunteer is None else status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def emergency_report_history(request, pk):
    report = get_object_or_404(reports_visible_to(request.user), pk=pk)
    events = report.events.select_related('actor').all()
    return Response(
        EmergencyReportEventSerializer(events, many=True).data,
        status=status.HTTP_200_OK,
    )
