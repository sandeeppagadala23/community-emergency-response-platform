
from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'role',
        'phone_number',
        'is_verified',
        'created_at',
    )

    list_filter = (
        'role',
        'is_verified',
    )

    search_fields = (
        'user__username',
        'user__email',
        'phone_number',
    )

    list_editable = (
        'role',
        'is_verified',
    )


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0


class CustomUserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)


# Add the profile inline to the built-in User admin.
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)
