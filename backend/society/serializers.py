
from rest_framework.serializers import ModelSerializer

from .models import Society, Block, Flat


class SocietySerializer(ModelSerializer):
    class Meta:
        model = Society
        fields = "__all__"


class BlockSerializer(ModelSerializer):
    class Meta:
        model = Block
        fields = "__all__"


class FlatSerializer(ModelSerializer):
    class Meta:
        model = Flat
        fields = "__all__"
