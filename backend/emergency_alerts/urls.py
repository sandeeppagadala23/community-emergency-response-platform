from django.urls import path

from . import views

app_name = "emergency_alerts"

urlpatterns = [
    # SOS alert endpoints
    path("sos/", views.create_sos_alert, name="create_sos"),
    path("sos/list/", views.list_sos_alerts, name="list_sos"),
    path("responders/", views.available_responders, name="available_responders"),
    path(
        "sos/<int:alert_id>/assign/",
        views.assign_responder,
        name="assign_responder",
    ),
    path(
        "sos/<int:alert_id>/check-in/",
        views.check_in_responder,
        name="check_in_responder",
    ),
    path(
        "sos/<int:alert_id>/assignments/<int:assignment_id>/confirm-arrival/",
        views.confirm_responder_arrival,
        name="confirm_responder_arrival",
    ),
    path(
        "sos/<int:alert_id>/resident-acknowledge/",
        views.acknowledge_responder_arrival,
        name="resident_acknowledge",
    ),
    path(
        "sos/<int:alert_id>/notifications/",
        views.incident_notifications,
        name="incident_notifications",
    ),
    path(
        "sos/<int:alert_id>/notifications/retry/",
        views.retry_incident_notifications,
        name="retry_incident_notifications",
    ),
    path(
        "sos/<int:alert_id>/status/",
        views.sos_alert_status,
        name="sos_status",
    ),
    path(
        "sos/<int:alert_id>/location/",
        views.update_sos_location,
        name="update_sos_location",
    ),
    path(
        "sos/<int:alert_id>/",
        views.sos_alert_detail,
        name="sos_detail",
    ),
    path(
        "sos/<int:alert_id>/acknowledge/",
        views.acknowledge_sos_alert,
        name="acknowledge_sos",
    ),
    path(
        "sos/<int:alert_id>/resolve/",
        views.resolve_sos_alert,
        name="resolve_sos",
    ),
    path(
        "sos/<int:alert_id>/transition/",
        views.transition_sos_alert,
        name="transition_sos",
    ),

    # Notification endpoints
    path(
        "notifications/",
        views.my_sos_notifications,
        name="my_sos_notifications",
    ),
    path(
        "notifications/unread-count/",
        views.unread_notification_count,
        name="unread_notification_count",
    ),
    path(
        "notifications/read-all/",
        views.mark_all_notifications_read,
        name="mark_all_notifications_read",
    ),
    path(
        "notifications/<int:notification_id>/read/",
        views.mark_sos_notification_read,
        name="mark_sos_notification_read",
    ),
]