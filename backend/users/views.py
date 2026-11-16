
from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.db import transaction, IntegrityError
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.contrib.auth.decorators import login_required

from .models import UserProfile
from .guardian import (
    get_active_alerts_for_guardian,
    get_guardian_notifications,
    get_unread_notification_count,
    get_user_profile,
    get_verified_guardian_links,
    is_guardian,
)
from emergency_contacts.models import EmergencyContact
from emergency_alerts.models import SOSAlert, SOSNotification
from emergency_reports.models import EmergencyReport


def root_redirect_view(request):
    if request.user.is_authenticated:
        try:
            profile = request.user.profile
        except UserProfile.DoesNotExist:
            profile = None

        if profile and profile.role == 'guardian':
            return redirect('guardian_dashboard')

        return redirect('dashboard')

    return redirect('login')


def register_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        phone_number = request.POST.get('phone_number', '').strip()
        password = request.POST.get('password', '')
        confirm_password = request.POST.get('confirm_password', '')
        role = request.POST.get('role', 'resident').strip().lower()

        if role != 'resident':
            messages.error(
                request,
                'Public registration is available for residents only. '
                'Please contact an administrator for other roles.'
            )
            return render(request, 'users/register.html')

        if not all([
            username, email, phone_number,
            password, confirm_password
        ]):
            messages.error(request, 'Please fill in all fields.')
            return render(request, 'users/register.html')

        try:
            validate_email(email)
        except ValidationError:
            messages.error(request, 'Please enter a valid email address.')
            return render(request, 'users/register.html')

        if password != confirm_password:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'users/register.html')

        if len(password) < 8:
            messages.error(
                request,
                'Password must contain at least 8 characters.'
            )
            return render(request, 'users/register.html')

        if User.objects.filter(username__iexact=username).exists():
            messages.error(request, 'This username is already taken.')
            return render(request, 'users/register.html')

        if User.objects.filter(email__iexact=email).exists():
            messages.error(request, 'This email is already registered.')
            return render(request, 'users/register.html')

        if UserProfile.objects.filter(phone_number=phone_number).exists():
            messages.error(
                request,
                'This phone number is already registered.'
            )
            return render(request, 'users/register.html')

        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                )
                UserProfile.objects.create(
                    user=user,
                    role='resident',
                    phone_number=phone_number,
                )

            messages.success(
                request,
                'Registration successful! Please log in.'
            )
            return redirect('login')

        except IntegrityError:
            messages.error(
                request,
                'Registration failed. Please try again with different details.'
            )

    return render(request, 'users/register.html')


def login_view(request):
    if request.user.is_authenticated:
        try:
            profile = request.user.profile
        except UserProfile.DoesNotExist:
            profile = None

        if profile and profile.role == 'guardian':
            return redirect('guardian_dashboard')

        return redirect('dashboard')

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        if not username or not password:
            messages.error(
                request,
                'Please enter your username and password.'
            )
            return render(request, 'users/login.html')

        user = authenticate(
            request,
            username=username,
            password=password,
        )

        if user is not None:
            login(request, user)
            messages.success(request, 'Login successful!')

            try:
                profile = user.profile
            except UserProfile.DoesNotExist:
                profile = None

            if profile and profile.role == 'guardian':
                return redirect('guardian_dashboard')

            return redirect('dashboard')

        messages.error(request, 'Invalid username or password.')

    return render(request, 'users/login.html')


@login_required(login_url='login')
def dashboard_view(request):
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        profile = None

    if profile and profile.role == 'guardian':
        return redirect('guardian_dashboard')

    user_flat = request.user.flats.select_related(
        'block', 'block__society'
    ).first()

    emergency_contacts = EmergencyContact.objects.filter(
        is_active=True
    ).select_related('society').order_by('service_type', 'name')

    recent_sos_alerts = SOSAlert.objects.filter(
        reporter=request.user
    ).order_by('-created_at')[:8]

    recent_reports = EmergencyReport.objects.filter(
        reporter=request.user
    ).order_by('-created_at')[:5]

    user_notifications = SOSNotification.objects.filter(
        recipient=request.user
    ).select_related('alert').order_by('-created_at')[:6]

    context = {
        'profile': profile,
        'user_flat': user_flat,
        'emergency_contacts': emergency_contacts,
        'recent_sos_alerts': recent_sos_alerts,
        'recent_reports': recent_reports,
        'user_notifications': user_notifications,
        'sos_categories': SOSAlert.CATEGORY_CHOICES,
    }

    return render(request, 'users/dashboard.html', context)


@login_required(login_url='login')
def logout_view(request):
    if request.method == 'POST':
        logout(request)
        messages.success(
            request,
            'You have logged out successfully.'
        )
        return redirect('login')

    return redirect('dashboard')


@login_required(login_url='login')
def guardian_dashboard_view(request):
    if not is_guardian(request.user):
        return redirect('dashboard')

    profile = get_user_profile(request.user)
    linked_links = get_verified_guardian_links(request.user)
    active_alerts = get_active_alerts_for_guardian(request.user)
    notifications = list(get_guardian_notifications(request.user))
    unread_count = get_unread_notification_count(request.user)

    context = {
        'profile': profile,
        'linked_links': linked_links,
        'active_alerts': active_alerts,
        'notifications': notifications,
        'unread_count': unread_count,
    }

    return render(
        request,
        'users/guardian_dashboard.html',
        context,
    )
