
from rest_framework import serializers

from .models import EmergencyContact, GuardianContact


class EmergencyContactSerializer(serializers.ModelSerializer):
    service_type_display = serializers.CharField(
        source="get_service_type_display",
        read_only=True
    )

    class Meta:
        model = EmergencyContact
        fields = "__all__"


class GuardianContactSerializer(serializers.ModelSerializer):
    guardian_type_display = serializers.CharField(
        source="get_guardian_type_display",
        read_only=True
    )
    resident_name = serializers.SerializerMethodField(read_only=True)
    resident_username = serializers.CharField(
        source="resident.username",
        read_only=True
    )

    def get_resident_name(self, obj):
        return obj.resident.get_full_name().strip() or obj.resident.username

    class Meta:
        model = GuardianContact
        fields = "__all__"
        read_only_fields = (
            "resident",
            "is_verified",
            "created_at",
        )
