from django.contrib import admin
from .models import Society, Block, Flat


@admin.register(Society)
class SocietyAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'pincode', 'created_at')
    search_fields = ('name', 'city', 'pincode')


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ('name', 'society', 'created_at')
    list_filter = ('society',)
    search_fields = ('name', 'society__name')


@admin.register(Flat)
class FlatAdmin(admin.ModelAdmin):
    list_display = ('flat_number', 'block', 'floor_number', 'created_at')
    list_filter = ('block', 'block__society')
    search_fields = ('flat_number', 'block__name')