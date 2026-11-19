from django.urls import path

from . import api_views
from . import security_views

urlpatterns = [
    path('csrf/', api_views.csrf_token, name='api_csrf'),
    path('login/', api_views.login_api, name='api_login'),
    path('register/', api_views.register_api, name='api_register'),
    path('me/', api_views.current_user_api, name='api_current_user'),
    path('logout/', api_views.logout_api, name='api_logout'),

    # Security Guard endpoints
    path('security/dashboard/', security_views.security_dashboard, name='api_security_dashboard'),
    path('security/profile/', security_views.security_profile, name='api_security_profile'),

    # Admin security guard management
    path('admin/security-guards/', security_views.admin_security_guards, name='api_admin_security_guards'),
    path('admin/security-guards/<int:guard_id>/', security_views.admin_security_guard_detail, name='api_admin_security_guard_detail'),
]