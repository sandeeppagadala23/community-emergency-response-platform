from django.db import models
from django.contrib.auth.models import User


class Society(models.Model):
    name = models.CharField(max_length=200)
    address = models.TextField()
    city = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Block(models.Model):
    society = models.ForeignKey(
        Society,
        on_delete=models.CASCADE,
        related_name='blocks'
    )
    name = models.CharField(max_length=100)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.society.name} - {self.name}"


class Flat(models.Model):
    block = models.ForeignKey(
        Block,
        on_delete=models.CASCADE,
        related_name='flats'
    )
    flat_number = models.CharField(max_length=20)
    floor_number = models.PositiveIntegerField()

    residents = models.ManyToManyField(
        User,
        blank=True,
        related_name='flats'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.block.name} - Flat {self.flat_number}"