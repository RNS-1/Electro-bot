from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.conf import settings
from datetime import datetime, timedelta, timezone
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
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import base64
import os
from django.core.exceptions import RequestAborted
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json

# MongoDB connection
client = MongoClient('mongodb+srv://rnschatv1rns:u5uxu9vKUnwEp2Na@snschatbot.uatzd.mongodb.net/?retryWrites=true&w=majority&appName=SNSchatbot')
db = client['ChatBot']
users_collection = db['users']
chats_collection = db['chats']
conversations_collection = db['conversations']

# Load models and configurations
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
INDEX_PATH = "vector_db.faiss"
METADATA_PATH = "metadata.txt"
CONTENT_PATH = "content.txt"
index = faiss.read_index(INDEX_PATH)

# Load metadata and content
with open(METADATA_PATH, "r", encoding='utf-8') as f:
    metadata = f.readlines()
metadata = [line.strip() for line in metadata]

with open(CONTENT_PATH, "r", encoding='utf-8') as f:
    content = f.readlines()
content = [line.strip() for line in content]

# Configure Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

# Initialize channel layer at module level
channel_layer = get_channel_layer()

def verify_token(token):
    """Verify JWT token and return user_id if valid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        return payload['user_id']
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

def get_query_embedding(query):
    """Convert user query into embedding using Sentence-Transformers."""
    query_embedding = embedding_model.encode(query, convert_to_numpy=True)
    return query_embedding.reshape(1, -1)

def regenerate_response_with_gemini(user_query, faiss_response, system_prompt=None):
    """Use Gemini API to regenerate a more coherent response based on FAISS results."""
    prompt = f"""
User Query: {user_query}

FAISS Retrieved Information:
{faiss_response}

Generate a response that correctly answers the user's query:
- If the user greets, respond with an appropriate greeting only.
- If the query is short, provide a concise and correct response (maximum 5 lines).
- Ensure sentences are grammatically correct and meaningful.
- If relevant, include helpful links. see answer only to the user's query giving them clear and concise information.
"""

    if system_prompt:
        prompt = f"{system_prompt}\n\n{prompt}"

    # Generate the response using Gemini model
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

    return response.text
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

@api_view(['POST'])
def admin_login(request):
    try:
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'error': 'Email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify email domain
        if not email.endswith('@snsgroups.com'):
            return Response(
                {'error': 'Invalid admin email domain'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find admin user
        admin = users_collection.find_one({'email': email})

        if not admin:
            return Response(
                {'error': 'Account not found'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), admin['password']):
            return Response(
                {'error': 'Invalid password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Generate token
        token = jwt.encode(
            {
                'user_id': str(admin['_id']),
                'email': email,
                'username': admin['username'],
                'isAdmin': True,
                'exp': datetime.utcnow() + timedelta(days=1)
            },
            settings.SECRET_KEY,
            algorithm='HS256'
        )

        return Response({
            'token': token,
            'username': admin['username'],
            'email': admin['email']
        })

    except Exception as e:
        return Response(
            {'error': 'Server error. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def admin_stats(request):
    """Get admin dashboard statistics."""
    try:
        # Get total regular users (excluding admins)
        total_users = users_collection.count_documents({'isAdmin': {'$ne': True}})

        # Get total chats
        total_chats = chats_collection.count_documents({})

        # Get active users in last 24 hours
        one_day_ago = datetime.utcnow() - timedelta(days=1)
        active_users = chats_collection.count_documents({
            'updated_at': {'$gte': one_day_ago}
        })

        # Get unresolved chats count
        unresolved_chats = chats_collection.count_documents({
            'conversations': {
                '$elemMatch': {
                    'resolve_needed': True
                }
            }
        })

        return Response({
            'totalUsers': total_users,
            'totalChats': total_chats,
            'activeUsers': active_users,
            'unresolvedChats': unresolved_chats
        })

    except Exception as e:
        print(f"Error in admin_stats: {str(e)}")
        return Response(
            {'error': 'Server error. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def unresolved_chats(request):
    """Get list of unresolved chats that need resolution."""
    try:
        # Get chats where resolve_needed is True
        unresolved = chats_collection.find(
            {'conversations': {
                '$elemMatch': {
                    'resolve_needed': True
                }
            }},
            {
                'email': 1,
                'conversations': 1,
                '_id': 1
            }
        )

        chats = []
        for chat in unresolved:
            # Get conversations that need resolution
            for conv in chat.get('conversations', []):
                if conv.get('resolve_needed'):
                    messages = conv.get('messages', [])
                    last_message = messages[-1]['content'] if messages else 'No message'

                    chats.append({
                        'id': str(chat['_id']),
                        'email': chat.get('email'),
                        'conversation_title': conv.get('title', 'New Chat'),
                        'last_message': decrypt_message(last_message),
                        'timestamp': conv.get('updated_at', conv.get('created_at')).strftime('%Y-%m-%d %H:%M:%S') if isinstance(conv.get('updated_at', conv.get('created_at')), datetime) else str(conv.get('updated_at', conv.get('created_at')))
                    })

        return Response({
            'unresolved_chats': chats
        })

    except Exception as e:
        print(f"Error in unresolved_chats: {str(e)}")
        return Response(
            {'error': 'Server error. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def resolve_chat(request, chat_id):
    """Handle chat resolution (accept/reject)."""
    try:
        action = request.data.get('action')
        if action not in ['accept', 'reject']:
            return Response({'error': 'Invalid action. Must be accept or reject'}, status=status.HTTP_400_BAD_REQUEST)

        result = chats_collection.update_one(
            {'_id': ObjectId(chat_id), 'conversations.resolve_needed': True},
            {'$set': {'conversations.$.resolve_needed': False, 'conversations.$.resolution_status': action, 'conversations.$.resolved_at': datetime.utcnow()}}
        )

        if result.modified_count == 0:
            return Response({'error': 'Chat not found or already resolved'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'message': f'Chat successfully {action}ed'})

    except Exception as e:
        print(f"Error in resolve_chat: {str(e)}")
        return Response({'error': 'Server error. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def admin_chat(request):
    """Handle admin chat messages and provide AI responses."""
    try:
        message = request.data.get('message')
        if not message:
            return Response(
                {'error': 'Message is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get query embedding
        query_embedding = get_query_embedding(message)
        
        # Search similar content using FAISS
        k = 3  # Number of similar chunks to retrieve
        distances, indices = index.search(query_embedding, k)
        
        # Get relevant content chunks
        relevant_chunks = [content[i] for i in indices[0]]
        context = "\n".join(relevant_chunks)
        
        # Generate response using the AI model
        system_prompt = """You are an AI assistant for the admin dashboard. 
        Help administrators with their queries about the system, content management, and administrative tasks.
        Be concise, professional, and helpful."""
        
        response = regenerate_response_with_gemini(message, context, system_prompt)

        return Response({
            'response': response,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })

    except Exception as e:
        print(f"Error in admin_chat: {str(e)}")
        return Response(
            {'error': 'Failed to process message'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def chat_with_llm(message, is_admin=False):
    """Chat with LLM with context awareness."""
    try:
        # Add admin context if it's an admin chat
        if is_admin:
            system_prompt = """You are an AI assistant for the SNS Groups admin panel.
            You can help with:
            1. User management and statistics
            2. System monitoring and issues
            3. Chat analysis and support
            4. Technical documentation and guides
            5. Best practices and recommendations

            Provide clear, concise, and professional responses."""

            # You can add more admin-specific context here
            context = f"""As an admin assistant, you have access to system information and management tools.
            Current context: Admin Dashboard
            Available actions: User management, System monitoring, Chat analysis
            Request: {message}"""

            # Combine the prompts for the final message
            final_message = f"{system_prompt}\n\nContext: {context}"
        else:
            # Regular user chat handling
            final_message = message
        # Use your existing chat function/API here
        # This is a placeholder - replace with your actual chat implementation
        response = "I understand you're asking about: " + message + "\n\nAs an admin assistant, I can help you with that..."

        return response

    except Exception as e:
        print(f"Error in chat_with_llm: {str(e)}")
        return "I apologize, but I encountered an error. Please try again."

@api_view(['GET'])
def fetch_chat_history(request, chat_id):
    """Fetch chat history for a specific chat ID."""
    try:
        chat = chats_collection.find_one({'_id': ObjectId(chat_id)})
        if not chat:
            return Response({'error': 'Chat not found'}, status=status.HTTP_404_NOT_FOUND)

        conversations = chat.get('conversations', [])
        messages = []
        for conv in conversations:
            for message in conv.get('messages', []):
                messages.append({
                    'role': message.get('role'),
                    'content': decrypt_message(message.get('content')),
                    'timestamp': message.get('timestamp')
                })

        chat_info = {
            'email': chat.get('email'),
            'title': conversations[0].get('title', 'New Chat') if conversations else 'New Chat'
        }

        return Response({
            'messages': messages,
            'chat_info': chat_info
        })

    except Exception as e:
        print(f"Error in fetch_chat_history: {str(e)}")
        return Response({'error': 'Server error. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def send_message(request, chat_id):
    """Send a message in the chat."""
    try:
        message = request.data.get('message')
        if not message:
            return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)

        chat = chats_collection.find_one({'_id': ObjectId(chat_id)})
        if not chat:
            return Response({'error': 'Chat not found'}, status=status.HTTP_404_NOT_FOUND)

        conversations = chat.get('conversations', [])
        if not conversations:
            return Response({'error': 'No conversations found'}, status=status.HTTP_404_NOT_FOUND)

        conversation = conversations[0]
        messages = conversation.get('messages', [])
        timestamp = datetime.utcnow().isoformat()

        encrypted_message = encrypt_message(message)
        messages.append({
            'role': 'admin',
            'content': encrypted_message,
            'timestamp': timestamp
        })

        chats_collection.update_one(
            {'_id': ObjectId(chat_id)},
            {'$set': {'conversations.0.messages': messages}}
        )

        return Response({'message': 'Message sent successfully', 'timestamp': timestamp})

    except Exception as e:
        print(f"Error in send_message: {str(e)}")
        return Response({'error': 'Server error. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def admin_get_chat(request, chat_id):
    """Get chat details for admin view."""
    try:
        # Find chat and verify it exists
        chat = chats_collection.find_one({'_id': ObjectId(chat_id)})
        if not chat:
            return Response({'error': 'Chat not found'}, status=status.HTTP_404_NOT_FOUND)

        formatted_conversations = []
        for conv in chat.get('conversations', []):
            messages = []
            for msg in conv.get('messages', []):
                try:
                    decrypted_content = decrypt_message(msg['content'])
                    messages.append({
                        'role': msg.get('role', 'unknown'),
                        'content': decrypted_content,
                        'timestamp': msg.get('timestamp', ''),
                        'is_admin_mode': msg.get('is_admin_mode', False)
                    })
                except Exception as e:
                    print(f"Error decrypting message: {e}")
                    messages.append({
                        'role': msg.get('role', 'unknown'),
                        'content': '[Decryption Error]',
                        'timestamp': msg.get('timestamp', '')
                    })

            formatted_conversations.append({
                'title': conv.get('title', 'Untitled'),
                'messages': messages,
                'created_at': conv.get('created_at', ''),
                'updated_at': conv.get('updated_at', ''),
                'resolve_needed': conv.get('resolve_needed', False),
                'is_admin_mode': conv.get('is_admin_mode', False)
            })

        return Response({
            'chat_info': {
                'email': chat.get('email', 'Unknown'),
                'conversations': formatted_conversations
            }
        })

    except Exception as e:
        print(f"Error in admin_get_chat: {str(e)}")
        return Response(
            {'error': 'Server error. Please try again.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def admin_send_message(request, chat_id):
    """Send a message as admin."""
    try:
        message = request.data.get('message')
        conversation_title = request.data.get('conversation_title')
        
        if not message:
            return Response(
                {'error': 'Message is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create a new message with message_id
        new_message = {
            'message_id': str(ObjectId()),  # Generate new ObjectId for message
            'role': 'admin',
            'content': encrypt_message(message),
            'timestamp': datetime.utcnow().isoformat()
        }

        # Update the conversation with the new message
        result = chats_collection.update_one(
            {
                '_id': ObjectId(chat_id),
                'conversations.title': conversation_title
            },
            {
                '$push': {
                    'conversations.$.messages': new_message
                }
            }
        )

        if result.modified_count == 0:
            return Response(
                {'error': 'Failed to send message'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Return the message with decrypted content
        return Response({
            'message': {
                'message_id': new_message['message_id'],
                'role': 'admin',
                'content': message,  # Return decrypted content
                'timestamp': new_message['timestamp']
            }
        })

    except Exception as e:
        print(f"Error in admin_send_message: {str(e)}")
        return Response(
            {'error': 'Server error. Please try again.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def admin_check_updates(request, chat_id):
    """Check for new messages in admin view."""
    try:
        last_update = request.GET.get('last_update')
        if not last_update:
            return Response(
                {'error': 'Last update timestamp required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        last_update_dt = datetime.fromisoformat(last_update)

        # Find chat and get new messages
        chat = chats_collection.find_one({'_id': ObjectId(chat_id)})
        if not chat:
            return Response({'error': 'Chat not found'}, status=status.HTTP_404_NOT_FOUND)

        new_messages = []
        for conv in chat.get('conversations', []):
            for msg in conv.get('messages', []):
                msg_timestamp = msg.get('timestamp')
                if isinstance(msg_timestamp, str):
                    msg_timestamp = datetime.fromisoformat(msg_timestamp)
                if msg_timestamp > last_update_dt:
                    try:
                        decrypted_content = decrypt_message(msg['content'])
                        new_messages.append({
                            'role': msg['role'],
                            'content': decrypted_content,
                            'timestamp': msg['timestamp'],
                            'conversation_title': conv.get('title'),
                            'is_admin_mode': msg.get('is_admin_mode', False)
                        })
                    except Exception as e:
                        print(f"Error decrypting message: {e}")

        return Response({
            'hasNewMessages': len(new_messages) > 0,
            'messages': new_messages
        })

    except Exception as e:
        print(f"Error in admin_check_updates: {e}")
        return Response(
            {'error': 'Server error. Please try again.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def handle_broken_pipe(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except RequestAborted:
            print("Client disconnected")
            return Response({'error': 'Client disconnected'}, 
                          status=status.HTTP_499_CLIENT_CLOSED_REQUEST)
        except Exception as e:
            print(f"Error in {func._name_}: {str(e)}")
            return Response({'error': 'Server error. Please try again.'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return wrapper

@api_view(['GET'])
def get_content(request):
    """Get the current bot content."""
    try:
        with open(CONTENT_PATH, "r", encoding='utf-8') as f:
            content = f.read()
        return Response({'content': content})
    except Exception as e:
        print(f"Error reading content: {str(e)}")
        return Response(
            {'error': 'Failed to read content'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def update_content(request):
    """Update the bot content and regenerate the index."""
    try:
        new_content = request.data.get('content')
        if not new_content:
            return Response(
                {'error': 'Content is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update content.txt
        with open(CONTENT_PATH, "w", encoding='utf-8') as f:
            f.write(new_content)

        # Split content into chunks and create embeddings
        chunks = new_content.split('\n')
        chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
        
        # Generate embeddings for new content
        embeddings = []
        for chunk in chunks:
            embedding = embedding_model.encode(chunk, convert_to_numpy=True)
            embeddings.append(embedding)

        # Create new FAISS index
        dimension = embeddings[0].shape[0]
        new_index = faiss.IndexFlatL2(dimension)
        embeddings_array = np.array(embeddings).astype('float32')
        new_index.add(embeddings_array)

        # Save new index
        faiss.write_index(new_index, INDEX_PATH)

        # Update metadata
        with open(METADATA_PATH, "w", encoding='utf-8') as f:
            for chunk in chunks:
                f.write(f"{chunk}\n")

        return Response({'message': 'Content updated successfully'})

    except Exception as e:
        print(f"Error updating content: {str(e)}")
        return Response(
            {'error': 'Failed to update content'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['DELETE'])
def delete_bot_message(request, chat_id, message_id):
    """Delete a bot message from the chat."""
    try:
        # Find the chat and message
        chat = chats_collection.find_one({'_id': ObjectId(chat_id)})
        if not chat:
            return Response(
                {'error': 'Chat not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Update all conversations in the chat to remove the message
        result = chats_collection.update_one(
            {'_id': ObjectId(chat_id)},
            {
                '$pull': {
                    'conversations.$[].messages': {
                        '_id': ObjectId(message_id),
                        'role': 'bot'  # Only allow deletion of bot messages
                    }
                }
            }
        )

        if result.modified_count == 0:
            return Response(
                {'error': 'Message not found or not a bot message'}, 
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({'message': 'Message deleted successfully'})

    except Exception as e:
        print(f"Error in delete_bot_message: {str(e)}")
        return Response(
            {'error': 'Server error. Please try again.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['DELETE'])
def delete_chat(request, chat_id):
    """Delete an entire chat and its conversations."""
    try:
        # Find and delete the chat
        result = chats_collection.delete_one({'_id': ObjectId(chat_id)})
        
        if result.deleted_count == 0:
            return Response(
                {'error': 'Chat not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Delete all related conversations
        conversations_collection.delete_many({'chat_id': chat_id})

        return Response({'message': 'Chat deleted successfully'})

    except Exception as e:
        print(f"Error in delete_chat: {str(e)}")
        return Response(
            {'error': 'Server error. Please try again.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
