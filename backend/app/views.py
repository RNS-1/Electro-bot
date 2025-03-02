from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.conf import settings
from datetime import datetime
import jwt
import bcrypt
from pymongo import MongoClient
from bson.objectid import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import google.generativeai as genai
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import base64
import os

SECRET_KEY = b'super_secret_key'  # Use a strong secret key stored securely
SALT = b'unique_salt_value'  # Use a secure and unique salt

def derive_key():
    """Derives a secure encryption key from SECRET_KEY and SALT."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=SALT,
        iterations=100000
    )
    return kdf.derive(SECRET_KEY)

def encrypt_message(message):
    """Encrypts a message using AES-256."""
    key = derive_key()
    iv = os.urandom(16)  # Generate a random IV
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()

    # Pad message to be a multiple of 16 bytes
    pad_length = 16 - (len(message) % 16)
    padded_message = message + (chr(pad_length) * pad_length)

    encrypted = encryptor.update(padded_message.encode()) + encryptor.finalize()
    return base64.b64encode(iv + encrypted).decode()

def decrypt_message(encrypted_message):
    """Decrypts an AES-256 encrypted message safely."""
    try:
        key = derive_key()
        encrypted_data = base64.b64decode(encrypted_message)

        if len(encrypted_data) < 16:
            return "[Decryption Error: Invalid encrypted data]"

        iv = encrypted_data[:16]  # Extract IV
        encrypted_content = encrypted_data[16:]

        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        decryptor = cipher.decryptor()
        decrypted_padded = decryptor.update(encrypted_content) + decryptor.finalize()

        # Remove PKCS7 padding
        pad_length = decrypted_padded[-1]
        if pad_length < 1 or pad_length > 16:
            return "[Decryption Error: Invalid padding]"

        return decrypted_padded[:-pad_length].decode()

    except Exception as e:
        return f"[Decryption Error: {str(e)}]"

# MongoDB connection
client = MongoClient('mongodb://localhost:27017/')
db = client['ChatBot']
users_collection = db['users']
chats_collection = db['chats']
conversations_collection = db['conversations']

# Configure Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

def verify_token(token):
    """Verify JWT token and return user_id if valid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        return payload['user_id']
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

@api_view(['POST'])
def chat(request):
    try:
        message = request.data.get('message')
        email = request.data.get('email')
        chat_title = request.data.get('chat_title')

        if not all([message, email]):
            return Response(
                {'error': 'Message and email are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find or create chat for the user
        chat = chats_collection.find_one({'email': email})
        if not chat:
            chat = {
                'email': email,
                'conversations': []
            }
            chats_collection.insert_one(chat)
            chat = chats_collection.find_one({'email': email})

        # Handle new chat creation
        if chat_title == 'New Chat':
            # Generate chat title
            counter = 1
            while any(conv['title'] == f"Chat {counter}" for conv in chat['conversations']):
                counter += 1
            chat_title = f"Chat {counter}"

            # Create new conversation
            active_conversation = {
                'title': chat_title,
                'messages': [],
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'resolve_needed': False
            }

            # Save new conversation first
            result = chats_collection.update_one(
                {'email': email},
                {'$push': {'conversations': {'$each': [active_conversation], '$position': 0}}}
            )

            if result.modified_count == 0:
                return Response(
                    {'error': 'Failed to create new chat'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Refresh chat data
            chat = chats_collection.find_one({'email': email})
            active_conversation = chat['conversations'][0]
        else:
            # Find existing conversation
            active_conversation = next(
                (conv for conv in chat['conversations'] if conv['title'] == chat_title),
                None
            )
            if not active_conversation:
                return Response(
                    {'error': 'Conversation not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Process user message
        encrypted_user_message = encrypt_message(message)
        timestamp = datetime.utcnow().isoformat()

        new_message = {
            'role': 'user',
            'content': encrypted_user_message,
            'timestamp': timestamp
        }

        # Update conversation with new message
        result = chats_collection.update_one(
            {
                'email': email,
                'conversations.title': active_conversation['title']
            },
            {
                '$push': {'conversations.$.messages': new_message},
                '$set': {'conversations.$.updated_at': datetime.utcnow()}
            }
        )

        if result.modified_count == 0:
            return Response(
                {'error': 'Failed to save message'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Generate bot response using Gemini API
        prompt = f"""
User Query: {message}

Generate a response that correctly answers the user's query:
- If the user greets, respond with an appropriate greeting only.
- If the query is short, provide a concise and correct response (maximum 5 lines).
- Ensure sentences are grammatically correct and meaningful.
- If relevant, include helpful links.
- If you cannot find anything related to the user query or it is not available, say so.
"""

        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
            "response_mime_type": "text/plain",
        }
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash-exp",
            generation_config=generation_config,
        )
        chat_session = model.start_chat(history=[])
        response = chat_session.send_message(prompt)
        bot_response = response.text

        # Store bot response
        encrypted_bot_response = encrypt_message(bot_response)
        bot_message = {
            'role': 'bot',
            'content': encrypted_bot_response,
            'timestamp': datetime.utcnow().isoformat()
        }

        # Update conversation with bot message
        result = chats_collection.update_one(
            {
                'email': email,
                'conversations.title': active_conversation['title']
            },
            {
                '$push': {'conversations.$.messages': bot_message},
                '$set': {'conversations.$.updated_at': datetime.utcnow()}
            }
        )

        if result.modified_count == 0:
            return Response(
                {'error': 'Failed to save bot response'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'response': bot_response,
            'timestamp': bot_message['timestamp'],
            'chat_title': chat_title
        })

    except Exception as e:
        print(f"Error in chat: {str(e)}")
        return Response(
            {'error': 'Server error. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def get_conversations(request):
    """Retrieve and decrypt all conversations for a user."""
    try:
        email = request.GET.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        user_chat = chats_collection.find_one({'email': email})
        if not user_chat:
            return Response({'conversations': []})

        conversations = []
        for conv in user_chat.get('conversations', []):
            decrypted_messages = []
            for msg in conv.get('messages', []):
                try:
                    # Ensure 'content' exists and is a valid base64 string before decrypting
                    if 'content' in msg and isinstance(msg['content'], str):
                        decrypted_content = decrypt_message(msg['content'])
                    else:
                        decrypted_content = "[Decryption Error: Invalid content format]"

                except Exception as e:
                    decrypted_content = f"[Decryption Error: {str(e)}]"

                decrypted_messages.append({
                    'role': msg['role'],
                    'content': decrypted_content,
                    'timestamp': msg['timestamp'].isoformat() if isinstance(msg['timestamp'], datetime) else msg['timestamp']
                })

            conversations.append({
                'title': conv['title'],
                'messages': decrypted_messages,
                'created_at': conv['created_at'].isoformat() if isinstance(conv['created_at'], datetime) else conv['created_at'],
                'updated_at': conv['updated_at'].isoformat() if isinstance(conv['updated_at'], datetime) else conv['updated_at']
            })

        return Response({'conversations': conversations})

    except Exception as e:
        return Response({'error': f'Server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
def delete_conversation(request):
    """Delete a conversation for a user."""
    try:
        email = request.data.get('email')
        chat_title = request.data.get('chat_title')

        if not email or not chat_title:
            return Response(
                {'error': 'Email and chat_title are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Remove the conversation from the user's document
        result = chats_collection.update_one(
            {'email': email},
            {'$pull': {'conversations': {'title': chat_title}}}
        )

        if result.modified_count > 0:
            return Response({'message': 'Conversation deleted successfully'})
        else:
            return Response(
                {'error': 'Conversation not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['PUT'])
def edit_chat_title(request):
    """Edit a chat title."""
    try:
        email = request.data.get('email')
        old_title = request.data.get('old_title')
        new_title = request.data.get('new_title')

        if not all([email, old_title, new_title]):
            return Response(
                {'error': 'Email, old_title, and new_title are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if new title already exists
        user_chat = chats_collection.find_one({'email': email})
        if user_chat:
            existing_chat = next(
                (conv for conv in user_chat['conversations'] if conv['title'] == new_title),
                None
            )
            if existing_chat:
                return Response(
                    {'error': 'Chat title already exists'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Update the chat title
        result = chats_collection.update_one(
            {
                'email': email,
                'conversations.title': old_title
            },
            {
                '$set': {
                    'conversations.$.title': new_title
                }
            }
        )

        if result.modified_count > 0:
            return Response({'message': 'Chat title updated successfully', 'new_title': new_title})
        else:
            return Response(
                {'error': 'Chat not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def create_new_chat(request):
    """Create a new chat conversation."""
    try:
        email = request.data.get('email')
        chat_title = request.data.get('title', '').strip()

        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find user's chat document
        chat = chats_collection.find_one({'email': email})
        if not chat:
            chat = {
                'email': email,
                'conversations': []
            }
            chats_collection.insert_one(chat)
            chat = chats_collection.find_one({'email': email})

        # Generate unique chat title
        if chat_title:
            base_title = chat_title
            counter = 1
            final_title = base_title
            while any(conv['title'] == final_title for conv in chat['conversations']):
                final_title = f"{base_title} {counter}"
                counter += 1
        else:
            counter = 1
            while any(conv['title'] == f"Chat {counter}" for conv in chat['conversations']):
                counter += 1
            final_title = f"Chat {counter}"

        # Create new conversation
        new_conversation = {
            'title': final_title,
            'messages': [],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'resolve_needed': False
        }

        # Add new conversation at the beginning of the list
        result = chats_collection.update_one(
            {'email': email},
            {'$push': {'conversations': {'$each': [new_conversation], '$position': 0}}}
        )

        if result.modified_count == 0:
            return Response(
                {'error': 'Failed to create new chat'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'message': 'Chat created successfully',
            'chat': {
                'id': final_title,
                'title': final_title,
                'messages': []
            }
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        print(f"Error creating new chat: {str(e)}")
        return Response(
            {'error': 'Server error. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
