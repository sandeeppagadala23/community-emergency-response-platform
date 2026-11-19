
from rest_framework import serializers

from .models import (
    SOSAlert,
    SOSAlertEvent,
    SOSNotification,
    ResponderAssignment,
)

class SOSAlertSerializer(serializers.ModelSerializer):
    reporter_username = serializers.CharField(
        source="reporter.username",
        read_only=True,
    )
    resident_name = serializers.SerializerMethodField(read_only=True)
    resident_flat = serializers.SerializerMethodField(read_only=True)
    acknowledged_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()

    def get_resident_name(self, alert):
        return alert.reporter.get_full_name().strip() or alert.reporter.username

    def get_resident_flat(self, alert):
        try:
            flats = list(alert.reporter.flats.select_related('block').all())
            if flats:
                return ', '.join(f'{f.block.name}-{f.flat_number}' for f in flats)
        except Exception:
            pass
        return None

    def get_acknowledged_by_name(self, alert):
        if alert.acknowledged_by is None:
            return None
        return alert.acknowledged_by.get_full_name().strip() or alert.acknowledged_by.username

    def get_resolved_by_name(self, alert):
        if alert.resolved_by is None:
            return None
        return alert.resolved_by.get_full_name().strip() or alert.resolved_by.username

    def validate(self, attrs):
        latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                "Latitude and longitude must be supplied together."
            )
        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError({"latitude": "Latitude must be between -90 and 90."})
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError({"longitude": "Longitude must be between -180 and 180."})
        if len(attrs.get("message", "")) > 200:
            raise serializers.ValidationError({"message": "Message must be 200 characters or fewer."})
        return attrs

    class Meta:
        model = SOSAlert
        fields = [
            "id",
            "reporter",
            "reporter_username",
            "resident_name",
            "resident_flat",
            "acknowledged_by_name",
            "resolved_by_name",
            "category",
            "message",
            "latitude",
            "longitude",
            "location_text",
            "status",
            "acknowledged_by",
            "resolved_by",
            "acknowledged_at",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reporter",
            "reporter_username",
            "status",
            "acknowledged_by",
            "resolved_by",
            "acknowledged_at",
            "resolved_at",
            "created_at",
            "updated_at",
        ]


class SOSAlertEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SOSAlertEvent
        fields = "__all__"
        read_only_fields = ["id", "actor", "created_at"]


class SOSNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SOSNotification
        fields = "__all__"
        read_only_fields = [
            "id",
            "recipient",
            "guardian_contact",
            "destination",
            "channel",
            "status",
            "message",
            "failure_reason",
            "created_at",
            "sent_at",
            "read_at",
        ]


class ResponderAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResponderAssignment
        fields = "__all__"
        read_only_fields = [
            "id",
            "assigned_at",
            "acknowledged_at",
            "completed_at",
        ]
