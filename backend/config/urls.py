from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

from users.views import root_redirect_view

urlpatterns = [
    # Root URL redirects to dashboard if authenticated, login if unauthenticated
    path('', root_redirect_view, name='home'),

    path('admin/', admin.site.urls),
    path('users/', include('users.urls')),
    path('api/auth/', include('users.api_urls')),
    path('reports/', include('emergency_reports.urls')),
    path('api/', include('society.urls')),
    path('api/', include('emergency_contacts.urls')),

    # Django REST Framework login/logout
    path('api-auth/', include('rest_framework.urls')),

    # Redirect profile URL to SOS notifications
    path(
        'accounts/profile/',
        RedirectView.as_view(
            url='/alerts/api/notifications/',
            permanent=False
        ),
        name='profile_redirect',
    ),

    # SOS Emergency Alert API
    path('alerts/api/', include('emergency_alerts.urls')),
]
