from django.urls import path

from . import api_views

urlpatterns = [
    path('csrf/', api_views.csrf_token, name='api_csrf'),
    path('login/', api_views.login_api, name='api_login'),
    path('register/', api_views.register_api, name='api_register'),
    path('me/', api_views.current_user_api, name='api_current_user'),
    path('logout/', api_views.logout_api, name='api_logout'),
]