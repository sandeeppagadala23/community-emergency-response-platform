
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import EmergencyContact, GuardianContact

User = get_user_model()


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
    resident = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
    )
    resident_name = serializers.SerializerMethodField(read_only=True)
    resident_username = serializers.CharField(
        source="resident.username",
        read_only=True
    )
    resident_flat = serializers.SerializerMethodField(read_only=True)
    is_verified = serializers.BooleanField(required=False)

    def get_resident_name(self, obj):
        return obj.resident.get_full_name().strip() or obj.resident.username

    def get_resident_flat(self, obj):
        try:
            flats = list(obj.resident.flats.select_related('block').all())
            if flats:
                return ', '.join(f'{f.block.name}-{f.flat_number}' for f in flats)
        except Exception:
            pass
        return None

    class Meta:
        model = GuardianContact
        fields = "__all__"
        read_only_fields = (
            "created_at",
        )
