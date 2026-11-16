
from django.urls import path
from . import views

app_name = 'emergency_reports'

urlpatterns = [
    # Existing website pages
    path(
        '',
        views.create_report_view,
        name='create_report',
    ),
    path(
        'my-reports/',
        views.my_reports_view,
        name='my_reports',
    ),

    # GET all reports and POST a new report
    path(
        'api/reports/',
        views.EmergencyReportListCreateAPIView.as_view(),
        name='api_reports',
    ),

    # GET, PUT, and PATCH a specific report
    path(
        'api/reports/<int:pk>/',
        views.EmergencyReportDetailAPIView.as_view(),
        name='api_report_detail',
    ),

    # Update the status of a report
    path(
        'api/reports/<int:pk>/status/',
        views.EmergencyReportStatusUpdateAPIView.as_view(),
        name='api_report_status_update',
    ),
    path(
        'api/reports/<int:pk>/assign/',
        views.assign_report_volunteer,
        name='api_report_assign_volunteer',
    ),
    path(
        'api/reports/<int:pk>/history/',
        views.emergency_report_history,
        name='api_report_history',
    ),
    path(
        'api/volunteers/',
        views.available_report_volunteers,
        name='api_available_volunteers',
    ),
]
