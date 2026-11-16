
from django.contrib import admin
from .models import EmergencyReport, EmergencyReportEvent


@admin.register(EmergencyReport)
class EmergencyReportAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'incident_type',
        'title',
        'reporter',
        'assigned_volunteer',
        'society',
        'location',
        'latitude',
        'longitude',
        'status',
        'responded_by',
        'created_at',
    )

    list_filter = (
        'incident_type',
        'status',
        'society',
    )

    search_fields = (
        'location',
        'description',
        'reporter__username',
        'responded_by__username',
        'assigned_volunteer__username',
    )
    readonly_fields = (
        'created_at',
        'updated_at',
    )


@admin.register(EmergencyReportEvent)
class EmergencyReportEventAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'report',
        'event_type',
        'from_status',
        'to_status',
        'actor',
        'created_at',
    )
    list_filter = ('event_type', 'from_status', 'to_status', 'created_at')
    search_fields = ('report__title', 'report__location', 'details', 'actor__username')
    readonly_fields = ('created_at',)
