from django.urls import path
from . import views

urlpatterns = [
    path('', views.root_redirect_view, name='users_home'),
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('guardian/dashboard/', views.guardian_dashboard_view, name='guardian_dashboard'),
    path('logout/', views.logout_view, name='logout'),
]
