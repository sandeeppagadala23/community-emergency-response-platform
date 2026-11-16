
from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import (
    SOSAlert,
    SOSAlertEvent,
    SOSNotification,
    EscalationPolicy,
    ResponderAssignment,
    ResponderArrivalConfirmation,
)


@admin.register(SOSAlert)
class SOSAlertAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "reporter",
        "category",
        "status",
        "created_at",
    )
    list_filter = ("category", "status", "created_at")
    search_fields = (
        "reporter__username",
        "message",
        "location_text",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "acknowledged_at",
        "resolved_at",
        "idempotency_key",
    )


@admin.register(SOSAlertEvent)
class SOSAlertEventAdmin(admin.ModelAdmin):
    list_display = ("id", "alert", "actor", "event_type", "created_at")
    list_filter = ("event_type", "created_at")
    search_fields = ("description", "event_type")
    readonly_fields = ("created_at",)


@admin.register(SOSNotification)
class SOSNotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "alert",
        "recipient",
        "channel",
        "status",
        "created_at",
    )
    list_filter = ("channel", "status", "created_at")
    search_fields = (
        "recipient__username",
        "guardian_contact__name",
        "destination",
        "message",
    )
    readonly_fields = ("created_at", "sent_at", "read_at")


@admin.register(EscalationPolicy)
class EscalationPolicyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "society",
        "first_escalation_minutes",
        "second_escalation_minutes",
        "is_active",
    )
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(ResponderAssignment)
class ResponderAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "alert",
        "responder",
        "assigned_at",
        "completed_at",
    )
    search_fields = ("responder__username", "notes")
    readonly_fields = ("assigned_at",)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "responder":
            user_model = get_user_model()
            kwargs["queryset"] = user_model.objects.filter(
                is_active=True,
                profile__role__in=["security", "volunteer"],
                profile__is_verified=True,
            ).distinct()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(ResponderArrivalConfirmation)
class ResponderArrivalConfirmationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "assignment",
        "confirmed_by",
        "confirmed_by_role",
        "confirmation_result",
        "confirmed_at",
    )
    list_filter = ("confirmed_by_role", "confirmation_result", "confirmed_at")
    search_fields = (
        "assignment__responder__username",
        "confirmed_by__username",
        "confirmation_note",
    )
    readonly_fields = (
        "assignment",
        "confirmed_by",
        "confirmed_by_role",
        "confirmation_result",
        "confirmation_note",
        "confirmed_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
