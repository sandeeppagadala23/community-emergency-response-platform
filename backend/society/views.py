
from rest_framework import viewsets
from rest_framework.permissions import BasePermission, IsAuthenticated

from .models import Society, Block, Flat
from .serializers import (
    SocietySerializer,
    BlockSerializer,
    FlatSerializer,
)


class IsAdminOrReadOnly(BasePermission):
    """
    Authenticated users can read.
    Only staff users or superusers can modify records.
    """

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True

        return user.is_staff or user.is_superuser


class SocietyViewSet(viewsets.ModelViewSet):
    queryset = Society.objects.all().order_by("id")
    serializer_class = SocietySerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]


class BlockViewSet(viewsets.ModelViewSet):
    queryset = Block.objects.select_related(
        "society"
    ).all().order_by("id")

    serializer_class = BlockSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]


class FlatViewSet(viewsets.ModelViewSet):
    queryset = (
        Flat.objects
        .select_related("block", "block__society")
        .prefetch_related("residents")
        .all()
        .order_by("id")
    )

    serializer_class = FlatSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
