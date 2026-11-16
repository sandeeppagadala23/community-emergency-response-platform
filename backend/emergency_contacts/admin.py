
from django.contrib import admin
from .models import ContactVerificationOTP, EmergencyContact, GuardianContact


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'service_type',
        'phone_number',
        'society',
        'is_active',
    )

    list_filter = (
        'service_type',
        'is_active',
        'society',
    )

    search_fields = (
        'name',
        'phone_number',
        'society__name',
    )


@admin.register(GuardianContact)
class GuardianContactAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'resident',
        'relationship',
        'phone_number',
        'guardian_type',
        'is_verified',
    )

    list_filter = (
        'guardian_type',
        'is_verified',
    )

    search_fields = (
        'name',
        'resident__username',
        'phone_number',
    )


@admin.register(ContactVerificationOTP)
class ContactVerificationOTPAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'contact',
        'attempts',
        'expires_at',
        'is_used',
        'created_at',
    )
    list_filter = ('is_used', 'created_at')
    search_fields = ('contact__name', 'contact__resident__username')
    readonly_fields = (
        'code_hash',
        'attempts',
        'expires_at',
        'is_used',
        'created_at',
    )
