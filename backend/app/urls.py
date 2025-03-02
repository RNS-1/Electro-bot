from django.urls import path
from . import views
from . import adminhome

urlpatterns = [
    path('api/chat/', views.chat, name='chat'),
    path('api/conversations/', views.get_conversations, name='get-conversations'),
    path('api/conversations/delete/', views.delete_conversation, name='delete-conversation'),
    path('api/conversations/edit/', views.edit_chat_title, name='edit-chat-title'),
    
    path('api/chat/new/', views.create_new_chat, name='create-new-chat'),    
]