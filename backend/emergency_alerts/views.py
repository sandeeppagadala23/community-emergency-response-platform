
from uuid import UUID

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    ResponderArrivalConfirmation,
    ResponderAssignment,
    SOSAlert,
    SOSAlertEvent,
    SOSNotification,
)
from .serializers import SOSAlertSerializer
from .notification_service import notify_sos_recipients
from users.models import UserProfile
from users.guardian import get_linked_resident_ids, get_user_profile


def registered_location_text(user):
    flats = user.flats.select_related("block", "block__society").order_by(
        "block__society__name",
        "block__name",
        "flat_number",
    )
    return "; ".join(
        f"{flat.block.name}-{flat.flat_number}, {flat.block.society.name}"
        for flat in flats
    )


def can_view_all_sos_alerts(user):
    if user.is_staff or user.is_superuser:
        return True

    profile = get_user_profile(user)
    return (
        profile is not None
        and profile.is_verified
        and profile.role == "security"
    )


def visible_sos_alerts(user):
    alerts = SOSAlert.objects.select_related("reporter")
    if can_view_all_sos_alerts(user):
        return alerts
    profile = get_user_profile(user)
    if profile is not None and profile.is_verified and profile.role == "volunteer":
        return alerts.filter(
            Q(reporter=user) | Q(assignments__responder=user)
        ).distinct()
    if profile is not None and getattr(profile, "role", "").lower() == "guardian":
        return alerts.filter(reporter_id__in=get_linked_resident_ids(user))
    return alerts.filter(reporter=user)


def has_desk_access(user):
    profile = get_user_profile(user)
    return user.is_staff or user.is_superuser or (
        profile is not None
        and profile.is_verified
        and profile.role == "security"
    )


def user_role(user):
    if user.is_staff or user.is_superuser:
        return "ADMIN"
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        profile = None
    return profile.role.upper() if profile is not None else "RESIDENT"


def assignment_data(assignment):
    try:
        confirmation = assignment.arrival_confirmation
    except ResponderArrivalConfirmation.DoesNotExist:
        confirmation = None

    return {
        "id": assignment.pk,
        "responder_id": assignment.responder_id,
        "responder_name": (
            assignment.responder.get_full_name().strip()
            or assignment.responder.username
        ),
        "responder_role": user_role(assignment.responder),
        "assigned_at": assignment.assigned_at,
        "checked_in_at": assignment.acknowledged_at,
        "completed_at": assignment.completed_at,
        "arrival_confirmation": (
            {
                "id": confirmation.pk,
                "incident_id": assignment.alert_id,
                "assignment_id": assignment.pk,
                "responder_id": assignment.responder_id,
                "responder_name": (
                    assignment.responder.get_full_name().strip()
                    or assignment.responder.username
                ),
                "confirmed_by_id": confirmation.confirmed_by_id,
                "confirmed_by_name": (
                    confirmation.confirmed_by.get_full_name().strip()
                    or confirmation.confirmed_by.username
                ),
                "confirmed_by_role": confirmation.confirmed_by_role.upper(),
                "confirmed_at": confirmation.confirmed_at,
                "confirmation_result": confirmation.confirmation_result,
                "confirmation_note": confirmation.confirmation_note,
            }
            if confirmation is not None
            else None
        ),
    }


def incident_detail_data(alert, user):
    data = SOSAlertSerializer(alert).data
    profile = get_user_profile(user)
    assignments = list(
        alert.assignments.select_related(
            "responder",
            "responder__profile",
            "arrival_confirmation",
            "arrival_confirmation__confirmed_by",
            "arrival_confirmation__confirmed_by__profile",
        )
    )
    my_assignment = next(
        (assignment for assignment in assignments if assignment.responder_id == user.pk),
        None,
    )
    events = list(
        alert.events.select_related("actor", "actor__profile")
    )
    resident_acknowledged = next(
        (
            event.created_at
            for event in events
            if event.event_type == "RESIDENT_ACKNOWLEDGED"
        ),
        None,
    )
    notifications = list(alert.notifications.filter(channel="IN_APP"))
    return {
        **data,
        "is_reporter": alert.reporter_id == user.pk,
        "created_by_role": user_role(alert.reporter),
        "has_location": alert.latitude is not None and alert.longitude is not None,
        "location_text": alert.location_text or registered_location_text(alert.reporter),
        "location": (
            {
                "latitude": alert.latitude,
                "longitude": alert.longitude,
                "captured_at": alert.created_at,
            }
            if alert.latitude is not None and alert.longitude is not None
            else None
        ),
        "timeline": [
            {
                "id": event.pk,
                "timestamp": event.created_at,
                "event": event.event_type,
                "description": event.description,
                "actor_role": user_role(event.actor) if event.actor else None,
            }
            for event in events
        ],
        "can_check_in": bool(
            my_assignment
            and my_assignment.acknowledged_at is None
            and alert.status == "ACKNOWLEDGED"
            and profile is not None
            and profile.is_verified
            and profile.role in {"security", "volunteer"}
        ),
        "my_assignment": (
            assignment_data(my_assignment) if my_assignment else None
        ),
        "assignments": [assignment_data(assignment) for assignment in assignments],
        "resident_acknowledged_at": resident_acknowledged,
        "notifications_summary": {
            "total": len(notifications),
            "sent": len(notifications),
            "delivered": sum(
                notification.status == "READ" for notification in notifications
            ),
            "failed": sum(notification.status == "FAILED" for notification in notifications),
        },
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_sos_alert(request):
    serializer = SOSAlertSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    raw_idempotency_key = request.headers.get("Idempotency-Key")
    try:
        idempotency_key = UUID(raw_idempotency_key) if raw_idempotency_key else None
    except (TypeError, ValueError):
        raise ValidationError({"Idempotency-Key": "A valid UUID is required."})

    with transaction.atomic():
        validated_data = dict(serializer.validated_data)
        if (
            validated_data.get("latitude") is None
            and not validated_data.get("location_text", "").strip()
        ):
            validated_data["location_text"] = registered_location_text(request.user)

        if idempotency_key is None:
            alert = SOSAlert.objects.create(
                reporter=request.user,
                **validated_data,
            )
            created = True
        else:
            alert, created = SOSAlert.objects.get_or_create(
                reporter=request.user,
                idempotency_key=idempotency_key,
                defaults=validated_data,
            )

        if created:
            SOSAlertEvent.objects.create(
                alert=alert,
                actor=request.user,
                event_type="CREATED",
                description="SOS alert created.",
            )
            notification_count = notify_sos_recipients(alert)
        else:
            notification_count = alert.notifications.filter(
                channel="IN_APP"
            ).count()

    response_data = SOSAlertSerializer(alert).data
    response_data["notifications_created"] = notification_count

    return Response(
        response_data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_sos_alerts(request):
    alerts = visible_sos_alerts(request.user).order_by("-created_at")

    serializer = SOSAlertSerializer(alerts, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sos_alert_detail(request, alert_id):
    alert = get_object_or_404(
        visible_sos_alerts(request.user).prefetch_related(
            "assignments",
            "events",
            "notifications",
        ),
        pk=alert_id,
    )

    return Response(
        incident_detail_data(alert, request.user),
        status=status.HTTP_200_OK,
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_sos_location(request, alert_id):
    alert = get_object_or_404(
        visible_sos_alerts(request.user),
        pk=alert_id,
    )
    if alert.reporter_id != request.user.pk and not has_desk_access(request.user):
        raise PermissionDenied(
            "Only the reporting resident, verified security, or administrators can update this location."
        )

    location_text = request.data.get("location_text")
    if not isinstance(location_text, str):
        raise ValidationError({"location_text": "Enter a location or landmark."})
    location_text = location_text.strip()
    if not location_text:
        raise ValidationError({"location_text": "Enter a location or landmark."})
    if len(location_text) > 255:
        raise ValidationError({"location_text": "Location must be 255 characters or fewer."})

    with transaction.atomic():
        alert = SOSAlert.objects.select_for_update().get(pk=alert.pk)
        if alert.location_text != location_text:
            alert.location_text = location_text
            alert.save(update_fields=["location_text", "updated_at"])
            SOSAlertEvent.objects.create(
                alert=alert,
                actor=request.user,
                event_type="LOCATION_UPDATED",
                description="Incident location description updated.",
            )

    return Response(
        {
            "id": alert.pk,
            "location_text": alert.location_text,
            "updated_at": alert.updated_at,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sos_alert_status(request, alert_id):
    alert = get_object_or_404(
        visible_sos_alerts(request.user).prefetch_related("notifications", "assignments"),
        pk=alert_id,
    )
    is_alert_reporter = alert.reporter_id == request.user.pk
    assignments = list(
        alert.assignments.select_related(
            "responder",
            "responder__profile",
            "arrival_confirmation",
            "arrival_confirmation__confirmed_by",
            "arrival_confirmation__confirmed_by__profile",
        )
    )
    in_app_notifications = alert.notifications.filter(channel="IN_APP")
    notification_statuses = list(
        in_app_notifications.values_list("status", flat=True)
    )
    sent_count = len(notification_statuses)
    delivered_count = notification_statuses.count("READ")
    failed_count = notification_statuses.count("FAILED")
    is_acknowledged = alert.status in ["ACKNOWLEDGED", "IN_PROGRESS"]
    has_checked_in_responder = any(
        assignment.acknowledged_at is not None
        for assignment in assignments
    )
    recipient_roles = sorted(
        {
            user_role(notification.recipient)
            for notification in in_app_notifications.select_related(
                "recipient",
                "recipient__profile",
            )
            if notification.recipient_id is not None
        }
    )
    resident_acknowledged = alert.events.filter(
        event_type="RESIDENT_ACKNOWLEDGED"
    ).first()
    simulated = alert.notifications.filter(
        channel__in=["EMAIL", "SMS"],
        status="SIMULATED",
    ).exists()

    return Response(
        {
            "id": str(alert.pk),
            "status": alert.status,
            "created_at": alert.created_at,
            "emergency_type": alert.category,
            "counts": {
                "total_recipients": len(notification_statuses),
                "sent": sent_count,
                "delivered": delivered_count,
                "failed": failed_count,
                "acknowledged": int(is_acknowledged),
            },
            "stages": {
                "recorded": True,
                "sent": sent_count > 0,
                "delivered": delivered_count > 0,
                "acknowledged": is_acknowledged,
            },
            "is_reporter": is_alert_reporter,
            "has_checked_in_responder": has_checked_in_responder,
            "arrival_reports": [
                assignment_data(assignment)
                for assignment in assignments
                if assignment.acknowledged_at is not None
            ],
            "resident_acknowledged_at": (
                resident_acknowledged.created_at if resident_acknowledged else None
            ),
            "is_simulated": simulated,
            "recipient_roles": recipient_roles,
            "failure_notes": None,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def acknowledge_sos_alert(request, alert_id):
    return _transition_sos_alert(request, alert_id, "ACKNOWLEDGED")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resolve_sos_alert(request, alert_id):
    return _transition_sos_alert(request, alert_id, "RESOLVED")


def _transition_sos_alert(request, alert_id, target_status, assignment_id=None):
    allowed_transitions = {
        "ACKNOWLEDGED": {"PENDING"},
        "IN_PROGRESS": {"ACKNOWLEDGED"},
        "RESOLVED": {"IN_PROGRESS"},
    }
    if target_status not in allowed_transitions:
        raise ValidationError({"status": "Choose Acknowledged, In Progress, or Resolved."})

    with transaction.atomic():
        alert = get_object_or_404(
            SOSAlert.objects.select_for_update(),
            pk=alert_id,
        )
        profile = get_user_profile(request.user)
        can_resolve_assigned_alert = (
            target_status == "RESOLVED"
            and profile is not None
            and profile.is_verified
            and profile.role == "volunteer"
            and ResponderAssignment.objects.select_for_update().filter(
                alert=alert,
                responder=request.user,
                acknowledged_at__isnull=False,
                arrival_confirmation__isnull=False,
            ).exists()
        )
        if not has_desk_access(request.user) and not can_resolve_assigned_alert:
            raise PermissionDenied(
                "Only verified security staff, administrators, or a checked-in assigned volunteer can update this alert status."
            )
        confirmed_assignment = None
        if target_status == "IN_PROGRESS":
            if assignment_id is None:
                raise ValidationError(
                    {"assignment_id": "Select the responder whose arrival was independently confirmed."}
                )
            confirmed_assignment = (
                ResponderAssignment.objects.select_for_update()
                .filter(
                    pk=assignment_id,
                    alert=alert,
                    acknowledged_at__isnull=False,
                    arrival_confirmation__isnull=False,
                )
                .first()
            )
            if confirmed_assignment is None:
                raise ValidationError(
                    {"assignment_id": "This responder has no independent arrival confirmation for the incident."}
                )
        if alert.status == target_status:
            return Response(
                SOSAlertSerializer(alert).data,
                status=status.HTTP_200_OK,
            )
        if alert.status not in allowed_transitions[target_status]:
            raise ValidationError(
                {"status": f"An alert in {alert.status} cannot transition to {target_status}."}
            )

        now = timezone.now()
        alert.status = target_status
        update_fields = ["status", "updated_at"]
        if target_status == "ACKNOWLEDGED":
            alert.acknowledged_by = request.user
            alert.acknowledged_at = now
            update_fields.extend(["acknowledged_by", "acknowledged_at"])
        elif target_status == "RESOLVED":
            alert.resolved_by = request.user
            alert.resolved_at = now
            update_fields.extend(["resolved_by", "resolved_at"])
            alert.assignments.filter(
                acknowledged_at__isnull=False,
                completed_at__isnull=True,
            ).update(completed_at=now)

        alert.save(update_fields=update_fields)
        SOSAlertEvent.objects.create(
            alert=alert,
            actor=request.user,
            event_type=target_status,
            description=(
                f"Alert status changed to {target_status.replace('_', ' ').title()} "
                f"for independently confirmed responder "
                f"{confirmed_assignment.responder.get_full_name().strip() or confirmed_assignment.responder.username} "
                f"(assignment #{confirmed_assignment.pk})."
                if confirmed_assignment is not None
                else f"Alert status changed to {target_status.replace('_', ' ').title()}."
            ),
        )

    return Response(
        SOSAlertSerializer(alert).data,
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def transition_sos_alert(request, alert_id):
    target_status = request.data.get("status")
    if isinstance(target_status, str):
        target_status = target_status.strip().upper()
    assignment_id = request.data.get("assignment_id")
    if assignment_id is not None:
        try:
            assignment_id = int(assignment_id)
        except (TypeError, ValueError):
            raise ValidationError({"assignment_id": "A valid responder assignment is required."})
    return _transition_sos_alert(request, alert_id, target_status, assignment_id)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_sos_notifications(request):
    notifications = (
        SOSNotification.objects
        .filter(recipient=request.user, channel="IN_APP")
        .select_related("alert", "report", "alert__reporter", "report__reporter")
        .order_by("-created_at")
    )

    data = []
    for notification in notifications:
        alert = notification.alert
        report = notification.report
        category = (
            alert.category
            if alert is not None
            else report.incident_type
            if report is not None
            else "EMERGENCY"
        )
        reporter = (
            alert.reporter
            if alert is not None
            else report.reporter
            if report is not None
            else None
        )
        location = (
            alert.location_text or registered_location_text(alert.reporter)
            if alert is not None
            else report.location
            if report is not None
            else None
        )
        incident_status = (
            alert.status
            if alert is not None
            else report.status
            if report is not None
            else None
        )
        data.append({
            "id": notification.id,
            "alert_id": notification.alert_id,
            "report_id": notification.report_id,
            "incident_id": (
                notification.report_id
                if notification.report_id is not None
                else notification.alert_id
            ),
            "category": category,
            "title": notification.title or (
                f"Emergency {category} SOS"
                if alert is not None
                else "Emergency report update"
            ),
            "notification_type": notification.notification_type,
            "message": notification.message,
            "channel": notification.channel,
            "status": notification.status,
            "created_at": notification.created_at,
            "read_at": notification.read_at,
            "read": notification.status == "READ" or notification.read_at is not None,
            "resident_name": (
                reporter.get_full_name().strip() or reporter.username
                if reporter is not None
                else None
            ),
            "resident_username": reporter.username if reporter is not None else None,
            "location": location,
            "incident_status": incident_status,
        })

    return Response(data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def unread_notification_count(request):
    count = SOSNotification.objects.filter(
        recipient=request.user,
        channel="IN_APP",
    ).exclude(status="READ").count()
    return Response({"count": count}, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    now = timezone.now()
    updated = SOSNotification.objects.filter(
        recipient=request.user,
        channel="IN_APP",
    ).exclude(status="READ").update(status="READ", read_at=now)
    return Response(
        {"updated": updated, "read_at": now},
        status=status.HTTP_200_OK,
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def mark_sos_notification_read(request, notification_id):
    with transaction.atomic():
        notification = get_object_or_404(
            SOSNotification.objects.select_for_update(),
            pk=notification_id,
            recipient=request.user,
            channel="IN_APP",
        )

        if notification.status != "READ":
            notification.status = "READ"
            notification.read_at = timezone.now()
            notification.save(
                update_fields=["status", "read_at"]
            )

    return Response(
        {
            "detail": "Notification marked as read.",
            "notification_id": notification.id,
            "status": notification.status,
            "read_at": notification.read_at,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def available_responders(request):
    if not has_desk_access(request.user):
        raise PermissionDenied("Only security staff and administrators can assign responders.")

    profiles = (
        UserProfile.objects.filter(
            role__in=["security", "volunteer"],
            is_verified=True,
            user__is_active=True,
        )
        .select_related("user")
        .order_by("user__username")
    )
    return Response(
        [
            {
                "id": profile.user_id,
                "name": profile.user.get_full_name().strip() or profile.user.username,
                "role": profile.role.upper(),
            }
            for profile in profiles
        ],
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_responder(request, alert_id):
    if not has_desk_access(request.user):
        raise PermissionDenied("Only security staff and administrators can assign responders.")

    alert = get_object_or_404(
        SOSAlert.objects.prefetch_related("assignments", "events", "notifications"),
        pk=alert_id,
    )
    if alert.status in ["RESOLVED", "CANCELLED"]:
        raise ValidationError("Closed alerts cannot be assigned.")

    responder_id = request.data.get("responder_id")
    if isinstance(responder_id, bool):
        raise ValidationError({"responder_id": "Select an active, verified responder."})
    try:
        responder_id = int(responder_id)
    except (TypeError, ValueError):
        raise ValidationError({"responder_id": "Select an active, verified responder."})

    profile = get_object_or_404(
        UserProfile.objects.select_related("user"),
        user_id=responder_id,
        role__in=["security", "volunteer"],
        is_verified=True,
        user__is_active=True,
    )
    if profile.user_id == alert.reporter_id:
        raise ValidationError("The resident who reported the alert cannot be assigned.")

    with transaction.atomic():
        assignment, created = ResponderAssignment.objects.get_or_create(
            alert=alert,
            responder=profile.user,
        )
        if created:
            SOSAlertEvent.objects.create(
                alert=alert,
                actor=request.user,
                event_type="RESPONDER_ASSIGNED",
                description=f"Responder {profile.user.username} assigned.",
            )
    return Response(
        assignment_data(assignment),
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def check_in_responder(request, alert_id):
    assignment = get_object_or_404(
        ResponderAssignment.objects.select_related("alert", "responder"),
        alert_id=alert_id,
        responder=request.user,
    )
    profile = get_user_profile(request.user)
    if (
        profile is None
        or not profile.is_verified
        or profile.role not in ["security", "volunteer"]
    ):
        raise PermissionDenied("Only verified responders can check in.")

    with transaction.atomic():
        alert = SOSAlert.objects.select_for_update().get(pk=alert_id)
        if alert.status != "ACKNOWLEDGED":
            raise ValidationError(
                "Security must acknowledge the alert before a responder reports arrival."
            )
        assignment = ResponderAssignment.objects.select_for_update().get(pk=assignment.pk)
        if assignment.acknowledged_at is not None:
            return Response(assignment_data(assignment), status=status.HTTP_200_OK)
        assignment.acknowledged_at = timezone.now()
        assignment.save(update_fields=["acknowledged_at"])
        SOSAlertEvent.objects.create(
            alert=alert,
            actor=request.user,
            event_type="RESPONDER_CHECK_IN_REPORTED",
            description="Responder reported arrival; awaiting independent dispatch confirmation.",
        )

    return Response(assignment_data(assignment), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_responder_arrival(request, alert_id, assignment_id):
    if not has_desk_access(request.user):
        raise PermissionDenied(
            "Only authorized security staff and administrators can confirm responder arrival."
        )

    if not isinstance(request.data, dict):
        raise ValidationError("A JSON object is required.")
    confirmation_note = request.data.get("confirmation_note", "")
    if not isinstance(confirmation_note, str) or len(confirmation_note) > 500:
        raise ValidationError(
            {"confirmation_note": "The confirmation note must be 500 characters or fewer."}
        )

    with transaction.atomic():
        alert = get_object_or_404(
            SOSAlert.objects.select_for_update(),
            pk=alert_id,
        )
        assignment = get_object_or_404(
            ResponderAssignment.objects.select_for_update(),
            pk=assignment_id,
            alert=alert,
        )
        confirmation = ResponderArrivalConfirmation.objects.filter(
            assignment=assignment,
        ).select_related("confirmed_by", "confirmed_by__profile").first()
        if confirmation is not None:
            return Response(
                assignment_data(assignment),
                status=status.HTTP_200_OK,
            )
        if alert.status != "ACKNOWLEDGED":
            raise ValidationError(
                "Arrival can only be confirmed while the incident is acknowledged."
            )
        if assignment.acknowledged_at is None:
            raise ValidationError(
                "The assigned responder must report arrival before it can be confirmed."
            )

        confirmation = ResponderArrivalConfirmation.objects.create(
            assignment=assignment,
            confirmed_by=request.user,
            confirmed_by_role=user_role(request.user),
            confirmation_result=ResponderArrivalConfirmation.RESULT_CONFIRMED,
            confirmation_note=confirmation_note.strip(),
        )
        SOSAlertEvent.objects.create(
            alert=alert,
            actor=request.user,
            event_type="RESPONDER_ARRIVAL_CONFIRMED",
            description=(
                f"{user_role(request.user)} independently confirmed arrival for "
                f"{assignment.responder.get_full_name().strip() or assignment.responder.username} "
                f"(assignment #{assignment.pk})."
            ),
        )

    return Response(
        assignment_data(assignment),
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def acknowledge_responder_arrival(request, alert_id):
    alert = get_object_or_404(
        SOSAlert.objects.prefetch_related("assignments", "events"),
        pk=alert_id,
        reporter=request.user,
    )
    checked_in = alert.assignments.filter(acknowledged_at__isnull=False).exists()
    if not checked_in:
        raise ValidationError("A responder must check in before arrival can be confirmed.")

    event = alert.events.filter(event_type="RESIDENT_ACKNOWLEDGED").first()
    if event is None:
        event = SOSAlertEvent.objects.create(
            alert=alert,
            actor=request.user,
            event_type="RESIDENT_ACKNOWLEDGED",
            description="Resident confirmed responder arrival.",
        )
    return Response(
        {"resident_acknowledged_at": event.created_at},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def incident_notifications(request, alert_id):
    if not has_desk_access(request.user):
        raise PermissionDenied("Only security staff and administrators can view dispatch logs.")

    alert = get_object_or_404(SOSAlert.objects.prefetch_related("notifications"), pk=alert_id)
    notifications = alert.notifications.select_related(
        "recipient",
        "recipient__profile",
        "guardian_contact",
    ).order_by("created_at")
    return Response(
        [
            {
                "id": str(notification.pk),
                "incident_id": str(alert.pk),
                "recipient_name": (
                    (
                        notification.recipient.get_full_name().strip()
                        or notification.recipient.username
                    )
                    if notification.recipient_id
                    else notification.guardian_contact.name
                    if notification.guardian_contact_id
                    else "Unspecified recipient"
                ),
                "recipient_role": (
                    user_role(notification.recipient)
                    if notification.recipient_id
                    else "GUARDIAN"
                    if notification.guardian_contact_id
                    else "UNKNOWN"
                ),
                "channel": notification.channel,
                "status": notification.status,
                "sent_at": notification.sent_at,
                "delivered_at": None,
                "read_at": notification.read_at,
                "created_at": notification.created_at,
                "failure_reason": notification.failure_reason or None,
                "is_simulated": notification.status == "SIMULATED",
                "retry_count": 0,
            }
            for notification in notifications
        ],
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def retry_incident_notifications(request, alert_id):
    if not has_desk_access(request.user):
        raise PermissionDenied("Only security staff and administrators can retry dispatches.")
    get_object_or_404(SOSAlert, pk=alert_id)
    return Response(
        {
            "code": "DELIVERY_NOT_CONFIGURED",
            "message": "SMS, email, and push delivery providers are not configured. In-app notifications are already available in recipients' inboxes.",
        },
        status=status.HTTP_501_NOT_IMPLEMENTED,
    )
