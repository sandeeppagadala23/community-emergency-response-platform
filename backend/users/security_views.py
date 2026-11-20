"""
Security Guard dashboard API and admin management views.

Endpoints:
  GET  /api/auth/security/dashboard/        – Security guard dashboard stats & alerts
  GET  /api/auth/security/profile/          – Security guard's own profile
  PATCH /api/auth/security/profile/         – Update own profile (safe fields only)
  GET  /api/admin/security-guards/          – Admin: list all security guards
  POST /api/admin/security-guards/          – Admin: create a new security guard
  PATCH /api/admin/security-guards/<id>/   – Admin: edit guard details / toggle active
"""

import re
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Case, Count, IntegerField, Q, When
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from emergency_alerts.models import SOSAlert, ResponderAssignment
from emergency_alerts.serializers import SOSAlertSerializer
from emergency_reports.models import EmergencyReport
from emergency_reports.serializers import EmergencyReportSerializer
from society.models import Society
from users.authentication import user_from_api_session_key
from users.guardian import get_user_profile
from users.models import UserProfile


# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------

def _is_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    profile = getattr(user, 'profile', None)
    return profile is not None and str(getattr(profile, 'role', '')).lower() == 'admin'


def _is_security(user):
    if not user or not user.is_authenticated:
        return False
    profile = getattr(user, 'profile', None)
    return (
        profile is not None
        and profile.is_verified
        and str(getattr(profile, 'role', '')).lower() == 'security'
        and user.is_active
    )


def _bearer_user(request):
    auth = request.headers.get('Authorization', '').split()
    if len(auth) == 2 and auth[0].lower() == 'bearer':
        return user_from_api_session_key(auth[1])
    return None


def _guard_data(user):
    """Serialise a security guard's profile data."""
    profile = UserProfile.objects.select_related('society').filter(user=user).first()
    return {
        'id': user.pk,
        'username': user.username,
        'name': user.get_full_name().strip() or user.username,
        'email': user.email,
        'phone': profile.phone_number if profile else '',
        'employee_id': profile.employee_id if profile else None,
        'shift': profile.shift if profile else '',
        'society': profile.society.name if (profile and profile.society) else None,
        'society_id': profile.society_id if profile else None,
        'is_active': user.is_active,
        'is_verified': profile.is_verified if profile else False,
        'role': 'SECURITY',
        'date_joined': user.date_joined,
    }


# ---------------------------------------------------------------------------
# Security Guard: Dashboard
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def security_dashboard(request):
    """
    GET /api/auth/security/dashboard/
    Returns real metrics + recent live SOS alerts + pending reports for the
    security guard's assigned community.
    Security guards and admins only.
    """
    user = request.user
    if not (_is_security(user) or _is_admin(user)):
        raise PermissionDenied('Only verified security personnel or administrators can access this dashboard.')

    profile = get_user_profile(user)

    # All SOS alerts visible to security (security can_view_all_sos_alerts)
    all_sos = SOSAlert.objects.select_related('reporter', 'acknowledged_by').prefetch_related('assignments')

    # Optimized Metrics: Single query aggregation for all SOS status metrics
    sos_metrics = all_sos.aggregate(
        total_active=Count(
            Case(
                When(status__in=['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'], then=1),
                output_field=IntegerField(),
            )
        ),
        new_sos=Count(
            Case(
                When(status='PENDING', then=1),
                output_field=IntegerField(),
            )
        ),
        acknowledged=Count(
            Case(
                When(status='ACKNOWLEDGED', then=1),
                output_field=IntegerField(),
            )
        ),
        in_progress=Count(
            Case(
                When(status='IN_PROGRESS', then=1),
                output_field=IntegerField(),
            )
        ),
        resolved=Count(
            Case(
                When(status='RESOLVED', then=1),
                output_field=IntegerField(),
            )
        ),
        cancelled=Count(
            Case(
                When(status='CANCELLED', then=1),
                output_field=IntegerField(),
            )
        ),
    )

    total_active = sos_metrics['total_active'] or 0
    new_sos_count = sos_metrics['new_sos'] or 0
    acknowledged_count = sos_metrics['acknowledged'] or 0
    in_progress_count = sos_metrics['in_progress'] or 0
    resolved_count = sos_metrics['resolved'] or 0
    cancelled_count = sos_metrics['cancelled'] or 0

    assigned_to_me_count = all_sos.filter(
        assignments__responder=user,
        status__in=['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS']
    ).count()

    active_reports = EmergencyReport.objects.filter(
        status__in=['PENDING', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS']
    )
    active_reports_count = active_reports.count()

    # Recent live alerts (up to 20, newest first)
    recent_alerts = all_sos.order_by('-created_at')[:20]
    alerts_data = []
    for alert in recent_alerts:
        my_assignment = alert.assignments.filter(responder=user).first()
        serialized_alert = SOSAlertSerializer(alert).data
        # Ensure category / emergency_type and status_display are populated cleanly
        category = serialized_alert.get('category') or getattr(alert, 'category', '') or 'OTHER'
        status_code = serialized_alert.get('status') or getattr(alert, 'status', '') or 'PENDING'
        status_display = getattr(alert, 'get_status_display', lambda: status_code)() or status_code
        alerts_data.append({
            **serialized_alert,
            'category': category,
            'emergency_type': category,
            'status': status_code,
            'status_display': status_display,
            'description': serialized_alert.get('message') or getattr(alert, 'message', '') or '',
            'has_location': alert.latitude is not None and alert.longitude is not None,
            'location_text': alert.location_text or '',
            'my_assignment_id': my_assignment.pk if my_assignment else None,
            'assigned_to_me': my_assignment is not None,
        })

    # Recent active reports (up to 15)
    recent_reports_qs = EmergencyReport.objects.select_related(
        'reporter', 'assigned_volunteer', 'responded_by'
    ).order_by('-created_at')[:15]
    reports_data = []
    for report in recent_reports_qs:
        serialized_report = EmergencyReportSerializer(report).data
        incident_type = serialized_report.get('incident_type') or getattr(report, 'incident_type', '') or 'OTHER'
        status_code = serialized_report.get('status') or getattr(report, 'status', '') or 'PENDING'
        status_display = serialized_report.get('status_display') or getattr(report, 'get_status_display', lambda: status_code)() or status_code
        reports_data.append({
            **serialized_report,
            'category': serialized_report.get('incident_type_display') or incident_type,
            'incident_type': incident_type,
            'status': status_code,
            'status_display': status_display,
        })

    return Response({
        'metrics': {
            'total_active': total_active,
            'new_sos': new_sos_count,
            'acknowledged': acknowledged_count,
            'in_progress': in_progress_count,
            'resolved': resolved_count,
            'cancelled': cancelled_count,
            'assigned_to_me': assigned_to_me_count,
            'active_reports': active_reports_count,
        },
        'live_alerts': alerts_data,
        'recent_reports': reports_data,
    }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Security Guard: Own Profile
# ---------------------------------------------------------------------------

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def security_profile(request):
    """
    GET  /api/auth/security/profile/   – View own profile
    PATCH /api/auth/security/profile/  – Update safe fields: shift, phone, email
    """
    user = request.user
    if not (_is_security(user) or _is_admin(user)):
        raise PermissionDenied('Only verified security personnel can access this endpoint.')

    if request.method == 'GET':
        return Response(_guard_data(user), status=status.HTTP_200_OK)

    # PATCH – safe fields only: shift, phone (if not taken), email
    data = request.data
    profile = get_user_profile(user)
    if profile is None:
        raise PermissionDenied('Profile not found.')

    allowed_fields = {'shift', 'email'}
    for field in allowed_fields:
        if field in data:
            if field == 'email':
                new_email = str(data['email']).strip()
                if User.objects.exclude(pk=user.pk).filter(email__iexact=new_email).exists():
                    raise ValidationError({'email': 'This email is already registered.'})
                user.email = new_email
            elif field == 'shift':
                new_shift = str(data['shift']).strip()
                if len(new_shift) > 50:
                    raise ValidationError({'shift': 'Shift must be 50 characters or fewer.'})
                profile.shift = new_shift

    # Disallow role, employee_id, is_verified, is_active changes from this endpoint
    for blocked in ('role', 'employee_id', 'is_verified', 'is_active', 'is_staff', 'is_superuser'):
        if blocked in data:
            raise PermissionDenied(f'The field "{blocked}" cannot be changed from this endpoint.')

    user.save(update_fields=['email'])
    profile.save(update_fields=['shift', 'updated_at'])

    return Response(_guard_data(user), status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Admin: Security Guard Management
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_security_guards(request):
    """
    GET  /api/admin/security-guards/  – List all security guards
    POST /api/admin/security-guards/  – Create a new security guard account
    """
    if not _is_admin(request.user):
        raise PermissionDenied('Only administrators can manage security guard accounts.')

    if request.method == 'GET':
        guards = User.objects.filter(
            profile__role='security'
        ).select_related('profile', 'profile__society').order_by('username')
        return Response([_guard_data(g) for g in guards], status=status.HTTP_200_OK)

    # POST – create new security guard
    data = request.data
    username = str(data.get('username', '')).strip()
    first_name = str(data.get('first_name', '')).strip()
    last_name = str(data.get('last_name', '')).strip()
    email = str(data.get('email', '')).strip()
    phone_number = str(data.get('phone_number', '')).strip()
    employee_id = str(data.get('employee_id', '')).strip() or None
    shift = str(data.get('shift', 'Day Shift')).strip()
    password = data.get('password', '')
    society_id = data.get('society_id') or None

    # Validation
    if not username or not phone_number or not password:
        raise ValidationError({'detail': 'username, phone_number, and password are required.'})
    if len(username) > 150:
        raise ValidationError({'username': 'Username must be 150 characters or fewer.'})
    if User.objects.filter(username__iexact=username).exists():
        raise ValidationError({'username': 'This username is already taken.'})
    if User.objects.filter(email__iexact=email).exists() and email:
        raise ValidationError({'email': 'This email is already registered.'})
    if UserProfile.objects.filter(phone_number=phone_number).exists():
        raise ValidationError({'phone_number': 'This phone number is already registered.'})
    if employee_id and UserProfile.objects.filter(employee_id=employee_id).exists():
        raise ValidationError({'employee_id': 'This employee ID is already in use.'})
    if shift and len(shift) > 50:
        raise ValidationError({'shift': 'Shift must be 50 characters or fewer.'})

    # Validate password strength
    candidate = User(username=username)
    try:
        validate_password(password, user=candidate)
    except DjangoValidationError as exc:
        raise ValidationError({'password': list(exc.messages)})

    # Society lookup (optional)
    society = None
    if society_id:
        try:
            society = Society.objects.get(pk=society_id)
        except Society.DoesNotExist:
            raise ValidationError({'society_id': 'Invalid society ID.'})

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
            )
            UserProfile.objects.create(
                user=user,
                role='security',
                phone_number=phone_number,
                employee_id=employee_id,
                shift=shift,
                society=society,
                is_verified=True,
            )
    except IntegrityError:
        raise ValidationError({'detail': 'Account details already in use. Please try again.'})

    return Response(_guard_data(user), status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def admin_security_guard_detail(request, guard_id):
    """
    GET   /api/admin/security-guards/<id>/  – View guard detail
    PATCH /api/admin/security-guards/<id>/  – Edit guard / activate or deactivate
    """
    if not _is_admin(request.user):
        raise PermissionDenied('Only administrators can manage security guard accounts.')

    try:
        guard = User.objects.select_related('profile', 'profile__society').get(
            pk=guard_id,
            profile__role='security',
        )
    except User.DoesNotExist:
        return Response({'detail': 'Security guard not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(_guard_data(guard), status=status.HTTP_200_OK)

    # PATCH
    data = request.data
    profile = guard.profile

    if 'first_name' in data:
        guard.first_name = str(data['first_name']).strip()
    if 'last_name' in data:
        guard.last_name = str(data['last_name']).strip()
    if 'email' in data:
        new_email = str(data['email']).strip()
        if User.objects.exclude(pk=guard.pk).filter(email__iexact=new_email).exists():
            raise ValidationError({'email': 'This email is already registered.'})
        guard.email = new_email
    if 'phone_number' in data:
        new_phone = str(data['phone_number']).strip()
        if UserProfile.objects.exclude(user=guard).filter(phone_number=new_phone).exists():
            raise ValidationError({'phone_number': 'This phone number is already registered.'})
        profile.phone_number = new_phone
    if 'employee_id' in data:
        new_eid = str(data['employee_id']).strip() or None
        if new_eid and UserProfile.objects.exclude(user=guard).filter(employee_id=new_eid).exists():
            raise ValidationError({'employee_id': 'This employee ID is already in use.'})
        profile.employee_id = new_eid
    if 'shift' in data:
        new_shift = str(data['shift']).strip()
        if len(new_shift) > 50:
            raise ValidationError({'shift': 'Shift must be 50 characters or fewer.'})
        profile.shift = new_shift
    if 'society_id' in data:
        sid = data['society_id']
        if sid is None:
            profile.society = None
        else:
            try:
                profile.society = Society.objects.get(pk=sid)
            except Society.DoesNotExist:
                raise ValidationError({'society_id': 'Invalid society ID.'})
    if 'is_active' in data:
        # Activate or deactivate the guard account
        guard.is_active = bool(data['is_active'])

    # Disallow role changes from this endpoint
    if 'role' in data or 'is_staff' in data or 'is_superuser' in data:
        raise PermissionDenied('Role and permission fields cannot be changed from this endpoint.')

    guard.save()
    profile.save()

    return Response(_guard_data(guard), status=status.HTTP_200_OK)
