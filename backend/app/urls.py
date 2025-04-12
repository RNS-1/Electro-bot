from django.urls import path
from .views import *

urlpatterns = [
       path('api/chatbot/', chatbot_view, name='chatbot'),

]
