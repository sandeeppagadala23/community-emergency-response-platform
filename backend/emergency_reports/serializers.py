
from rest_framework import serializers
from .models import EmergencyReport, EmergencyReportEvent


class EmergencyReportSerializer(serializers.ModelSerializer):
    title = serializers.CharField(max_length=200, allow_blank=False)
    reporter_username = serializers.CharField(source='reporter.username', read_only=True)
    reporter_name = serializers.SerializerMethodField()
    assigned_volunteer_username = serializers.CharField(
        source='assigned_volunteer.username',
        read_only=True,
        allow_null=True,
    )
    assigned_volunteer_name = serializers.SerializerMethodField()
    responded_by_username = serializers.CharField(
        source='responded_by.username',
        read_only=True,
        allow_null=True,
    )
    incident_type_display = serializers.CharField(
        source='get_incident_type_display',
        read_only=True
    )

    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )

    def get_reporter_name(self, report):
        return report.reporter.get_full_name().strip() or report.reporter.username

    def get_assigned_volunteer_name(self, report):
        if report.assigned_volunteer is None:
            return None
        return (
            report.assigned_volunteer.get_full_name().strip()
            or report.assigned_volunteer.username
        )

    class Meta:
        model = EmergencyReport
        fields = [
            'id',
            'title',
            'reporter',
            'reporter_username',
            'reporter_name',
            'responded_by',
            'responded_by_username',
            'assigned_volunteer',
            'assigned_volunteer_username',
            'assigned_volunteer_name',
            'society',
            'incident_type',
            'incident_type_display',
            'location',
            'latitude',
            'longitude',
            'description',
            'response_notes',
            'status',
            'status_display',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'id',
            'reporter',
            'responded_by',
            'responded_by_username',
            'assigned_volunteer',
            'assigned_volunteer_username',
            'assigned_volunteer_name',
            'status',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        latitude = attrs.get(
            'latitude',
            getattr(self.instance, 'latitude', None),
        )
        longitude = attrs.get(
            'longitude',
            getattr(self.instance, 'longitude', None),
        )
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError({
                'latitude': 'Provide latitude and longitude together.',
            })
        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError({
                'latitude': 'Latitude must be between -90 and 90.',
            })
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError({
                'longitude': 'Longitude must be between -180 and 180.',
            })
        return attrs


class EmergencyReportStatusSerializer(serializers.ModelSerializer):
    responded_by_username = serializers.CharField(
        source='responded_by.username',
        read_only=True,
        allow_null=True,
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    assigned_volunteer_username = serializers.CharField(
        source='assigned_volunteer.username',
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = EmergencyReport
        fields = [
            'id',
            'status',
            'status_display',
            'responded_by',
            'responded_by_username',
            'assigned_volunteer',
            'assigned_volunteer_username',
            'response_notes',
            'updated_at',
        ]

        read_only_fields = [
            'id',
            'responded_by',
            'responded_by_username',
            'assigned_volunteer',
            'assigned_volunteer_username',
            'updated_at',
        ]


class EmergencyReportEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source='actor.username',
        read_only=True,
        allow_null=True,
    )
    actor_name = serializers.SerializerMethodField()
    event_type_display = serializers.CharField(
        source='get_event_type_display',
        read_only=True,
    )

    def get_actor_name(self, event):
        if event.actor is None:
            return None
        return event.actor.get_full_name().strip() or event.actor.username

    class Meta:
        model = EmergencyReportEvent
        fields = [
            'id',
            'event_type',
            'event_type_display',
            'from_status',
            'to_status',
            'details',
            'actor',
            'actor_username',
            'actor_name',
            'created_at',
        ]
        read_only_fields = fields
