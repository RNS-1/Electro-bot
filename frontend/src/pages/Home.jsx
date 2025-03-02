import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, Menu, X, User, Clock, Plus, Trash2, ChevronDown, Bot, Edit, Copy, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';
import { w3cwebsocket as W3CWebSocket } from 'websocket';
import { MessageSquare} from 'lucide-react';


const Home = () => {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [chats, setChats] = useState([{ id: "default", name: "New Chat", messages: [] }]);
  const [activeChatId, setActiveChatId] = useState("default");
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const chatContainerRef = useRef(null);
  const typingTimeout = useRef(null);
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('email');
  const [newChatTitle, setNewChatTitle] = useState("");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editChatTitle, setEditChatTitle] = useState("");
  const [wsClient, setWsClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [autoUpdate, setAutoUpdate] = useState(true);

  

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    const client = new W3CWebSocket(`ws://localhost:8000/ws/chat/${userEmail}/`);

    client.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      if (activeChatId) {
        client.send(JSON.stringify({
          type: 'subscribe',
          chat_id: activeChatId,
          email: userEmail
        }));
      }
    };

    client.onmessage = (message) => {
      const data = JSON.parse(message.data);
      handleWebSocketMessage(data);
    };

    client.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      setTimeout(() => setupWebSocket(), 3000);
    };

    setWsClient(client);

    return () => {
      client.close();
    };
  }, [userEmail, activeChatId]);

  useEffect(() => {
    if (!autoUpdate || !activeChatId) return;

    const fetchUpdates = async () => {
      try {
        if (wsClient && isConnected) {
          wsClient.send(JSON.stringify({
            type: 'get_updates',
            email: userEmail,
            chat_id: activeChatId,
            last_update: lastUpdate
          }));
        } else {
          await fetchLatestMessages();
        }
      } catch (error) {
        console.error('Error fetching updates:', error);
      }
    };

    fetchUpdates();
    const updateInterval = setInterval(fetchUpdates, 1000);

    return () => clearInterval(updateInterval);
  }, [wsClient, isConnected, activeChatId, lastUpdate, autoUpdate]);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'chat_message':
        if (data.chat_id === activeChatId) {
          updateChatUI(data.content);
        }
        break;

      case 'chat_update':
        fetchConversations();
        break;

      case 'typing_status':
        setIsTyping(data.is_typing);
        break;

      case 'updates':
        if (data.messages && data.messages.length > 0) {
          setChatHistory(prev => {
            const newMessages = data.messages.filter(newMsg =>
              !prev.some(existingMsg =>
                existingMsg.content === newMsg.content &&
                existingMsg.timestamp === newMsg.timestamp
              )
            );
            return [...prev, ...newMessages];
          });
          setLastUpdate(Date.now());
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/conversations/?email=${userEmail}`);

      if (response.ok) {
        const data = await response.json();
        if (data.conversations.length === 0) {
          // Create default chat if no conversations exist
          const defaultChat = {
            id: 'New Chat',
            name: 'New Chat',
            messages: [{
              role: 'bot',
              content: 'Hello! How can I assist you today?',
              timestamp: new Date().toISOString()
            }]
          };
          setChats([defaultChat]);
          setActiveChatId(defaultChat.id);
          setChatHistory(defaultChat.messages);
        } else {
          const formattedChats = data.conversations.map(conv => ({
            id: conv.title,
            name: conv.title,
            messages: conv.messages
          }));
          setChats(formattedChats);
          setActiveChatId(formattedChats[0].id);
          setChatHistory(formattedChats[0].messages);
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Failed to load conversations');
    }
  };

  const fetchLatestMessages = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/chat/updates/?email=${userEmail}&chat_id=${activeChatId}&last_update=${lastUpdate}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          setChatHistory(prev => {
            const newMessages = data.messages.filter(newMsg =>
              !prev.some(existingMsg =>
                existingMsg.content === newMsg.content &&
                existingMsg.timestamp === newMsg.timestamp
              )
            );
            return [...prev, ...newMessages];
          });
          setLastUpdate(Date.now());
        }
      }
    } catch (error) {
      console.error('Error fetching updates:', error);
    }
  };

  const switchChat = (chatId) => {
    setActiveChatId(chatId);
    const selectedChat = chats.find(chat => chat.id === chatId);
    if (selectedChat) {
      setChatHistory(selectedChat.messages || []);
      setShowSidebar(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = {
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
    };

    setMessage('');
    setError(null);
    setIsLoading(true);

    try {
        setChatHistory(prev => [...prev, userMessage]);

        const response = await fetch('http://localhost:8000/api/chat/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: userMessage.content,
                email: userEmail,
                chat_title: activeChatId
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to get response from chatbot');
        }

        const data = await response.json();

        if (data && data.response) {
            // Remove the "admin will contact you" message if this is an admin message
            if (chatHistory.some(msg => msg.role === 'admin')) {
                setChatHistory(prev => prev.filter(msg =>
                    msg.content !== "I will send your request to our admin and admin will contact you shortly"
                ));
            }

            const botMessage = {
                role: data.role || 'bot',
                content: data.response,
                timestamp: data.timestamp
            };

            // Update chat history
            setChatHistory(prev => [...prev, botMessage]);

            // Update chats list
            setChats(prev => prev.map(chat =>
                chat.id === activeChatId
                    ? {
                        ...chat,
                        messages: [...chat.messages, userMessage, botMessage]
                    }
                    : chat
            ));

            // Scroll to bottom
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        }
    } catch (err) {
        console.error('Error sending message:', err);
        setError('Failed to send message. Please try again.');
        setChatHistory(prev => prev.filter(msg => msg !== userMessage));
    } finally {
        setIsLoading(false);
    }
  };

  const updateChatUI = (botResponse) => {
    setChatHistory(prev => [
      ...prev,
      {
        role: "bot",
        content: botResponse,
        timestamp: new Date().toISOString(),
      }
    ]);

    setChats(prev => prev.map(chat =>
      chat.id === activeChatId
        ? {
            ...chat,
            messages: [
              ...chat.messages,
              {
                role: "bot",
                content: botResponse,
                timestamp: new Date().toISOString(),
              }
            ]
          }
        : chat
    ));

    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, x: -20 },
  };

  const scrollToBottom = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const renderNewChatDialog = () => (
    <AnimatePresence>
      {showNewChatDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-white rounded-lg p-6 w-full max-w-md"
          >
            <h2 className="text-xl font-semibold mb-4">Create New Chat</h2>
            <input
              type="text"
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              placeholder="Enter chat title (or leave empty for default)"
              className="w-full p-2 border rounded mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewChatDialog(false);
                  setNewChatTitle("");
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newChatTitle.trim()) {
                    createNewChat();
                  } else {
                    createNewChat();
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const handleNewChatClick = () => {
    setShowNewChatDialog(true);
  };

  const editChat = async (chatId) => {
    try {
      if (!editChatTitle.trim()) {
        setError('Chat title is required');
        return;
      }

      const response = await fetch('http://localhost:8000/api/conversations/edit/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          old_title: chatId,
          new_title: editChatTitle.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setChats(prev => prev.map(chat =>
          chat.id === chatId ? { ...chat, id: data.new_title, name: data.new_title } : chat
        ));
        if (activeChatId === chatId) {
          setActiveChatId(data.new_title);
        }
        setShowEditDialog(false);
        setEditingChatId(null);
        setEditChatTitle("");
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to edit chat title');
      }
    } catch (error) {
      console.error('Error editing chat:', error);
      setError('Failed to edit chat title');
    }
  };

  const renderEditDialog = () => (
    <AnimatePresence>
      {showEditDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-white rounded-lg p-6 w-full max-w-md"
          >
            <h2 className="text-xl font-semibold mb-4">Edit Chat Title</h2>
            <input
              type="text"
              value={editChatTitle}
              onChange={(e) => setEditChatTitle(e.target.value)}
              placeholder="Enter new chat title"
              className="w-full p-2 border rounded mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingChatId(null);
                  setEditChatTitle("");
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => editChat(editingChatId)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const formatBotResponse = (content) => {
    const segments = [];
    let currentText = '';

    // Regular expressions for different content types
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const bulletPointRegex = /^\*\s+(.+)$/gm;  // Matches lines starting with "* "
    let lastIndex = 0;

    // Pre-process bullet points
    content = content.replace(bulletPointRegex, '<bullet>$1</bullet>');

    // Find code blocks first
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        currentText += content.slice(lastIndex, match.index);
      }

      if (currentText) {
        segments.push({ type: 'text', content: processTextFormatting(currentText) });
        currentText = '';
      }

      segments.push({
        type: 'code',
        language: match[1] || 'javascript',
        content: match[2].trim()
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    currentText += content.slice(lastIndex);

    // Process links in remaining text
    if (currentText) {
      let textWithLinks = currentText;
      const linkSegments = [];
      lastIndex = 0;

      while ((match = linkRegex.exec(textWithLinks)) !== null) {
        if (match.index > lastIndex) {
          linkSegments.push({
            type: 'text',
            content: processTextFormatting(textWithLinks.slice(lastIndex, match.index))
          });
        }

        linkSegments.push({
          type: 'link',
          text: match[1],
          url: match[2]
        });

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < textWithLinks.length) {
        linkSegments.push({
          type: 'text',
          content: processTextFormatting(textWithLinks.slice(lastIndex))
        });
      }

      segments.push(...linkSegments);
    }

    return segments;
  };

  const processTextFormatting = (text) => {
    // Convert bullet points to styled elements
    text = text.replace(/<bullet>(.*?)<\/bullet>/g, (match, content) => {
      return `<div class="bullet-point">${content}</div>`;
    });

    // Process bold text (without asterisks)
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Process italic text (without asterisks)
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return text;
  };

  // Update the styles
  const styles = `
    .text-formatting {
      @apply space-y-2;
    }

    .text-formatting strong {
      @apply font-bold;
    }

    .text-formatting em {
      @apply italic text-gray-600;
    }

    .text-formatting .bullet-point {
      @apply flex items-center gap-3 pl-4 py-1 relative;
    }

    .text-formatting .bullet-point::before {
      content: "";
      @apply absolute left-0 w-2 h-2 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm;
      top: 50%;
      transform: translateY(-50%);
    }

    .text-formatting .bullet-point:hover::before {
      @apply scale-110 transition-transform;
    }

    /* Add a subtle line connecting bullet points */
    .text-formatting .bullet-point:not(:last-child)::after {
      content: "";
      @apply absolute left-[3px] w-[2px] h-full bg-blue-100;
      top: 50%;
    }

    /* Hover effect for bot responses */
    .bot-message .text-formatting {
      @apply transition-all duration-200;
    }

    .bot-message .group:hover .text-formatting {
      @apply bg-gray-50/80 backdrop-blur-sm;
    }
  `;

  // Add this new component for bot responses
  const BotResponse = ({ content }) => {
    const handleCopy = () => {
      try {
        // Remove HTML tags and decode entities for clean text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const cleanText = tempDiv.textContent || tempDiv.innerText;

        navigator.clipboard.writeText(cleanText);
        toast.success('Response copied!');
      } catch (error) {
        toast.error('Failed to copy response');
      }
    };

    return (
      <div className="relative group">
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-700/50 hover:bg-gray-700 text-white text-xs backdrop-blur-sm transition-colors"
            title="Copy response"
          >
            <Copy size={12} />
            <span>Copy</span>
          </button>
        </div>
        <div
          className="p-3 text-formatting relative bg-white/50 rounded-lg"
          dangerouslySetInnerHTML={{
            __html: content
          }}
        />
      </div>
    );
  };

  // Update the TextSegment component to use BotResponse
  const TextSegment = ({ content }) => {
    return <BotResponse content={content} />;
  };

  const CodeBlock = ({ language, content }) => {
    const handleCopy = () => {
      navigator.clipboard.writeText(content);
      toast.success('Code copied to clipboard!');
    };

    return (
      <div className="relative group">
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-2 rounded bg-gray-800 hover:bg-gray-700 text-white"
            title="Copy code"
          >
            <Copy size={14} />
          </button>
        </div>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          className="rounded-lg !mt-2 !mb-2"
          customStyle={{
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: '1.5'
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    );
  };

  const createNewChat = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/chat/new/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          title: newChatTitle.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create new chat');
      }

      const data = await response.json();

      // Create new chat object
      const newChat = {
        id: data.chat.id,
        name: data.chat.title,
        messages: []
      };

      // Update chats list
      setChats(prev => [newChat, ...prev.filter(chat => chat.id !== 'New Chat')]);

      // Switch to new chat
      setActiveChatId(newChat.id);
      setChatHistory([]);

      // Reset states
      setMessage('');
      setShowNewChatDialog(false);
      setNewChatTitle('');
      setError(null);

      // Scroll to top of chat
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = 0;
      }

      toast.success('New chat created successfully');
    } catch (error) {
      console.error('Error creating new chat:', error);
      toast.error('Failed to create new chat');
      setError('Failed to create new chat');
    }
  };

  const deleteChat = async (chatId) => {
    try {
      const response = await fetch('http://localhost:8000/api/conversations/delete/', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          chat_title: chatId
        })
      });

      if (response.ok) {
        setChats(prev => prev.filter(chat => chat.id !== chatId));

        if (activeChatId === chatId) {
          const remainingChats = chats.filter(chat => chat.id !== chatId);
          if (remainingChats.length > 0) {
            setActiveChatId(remainingChats[0].id);
            setChatHistory(remainingChats[0].messages);
          } else {
            createNewChat();
          }
        }
        toast.success('Chat deleted successfully');
      } else {
        throw new Error('Failed to delete chat');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    }
  };

  const renderChatHeader = () => (
    <div className="h-14 border-b bg-gray-800 flex items-center px-4 gap-3 justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowSidebar(true)}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="text-gray-600" size={20} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <MessageCircle className="text-white" size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-blue-400 truncate">
              {chats.find((chat) => chat.id === activeChatId)?.name || "AI Assistant"}
            </h1>
            <p className="text-xs text-gray-500">Online</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        
        {isTyping && (
          <span className="text-xs text-gray-500">
            Bot is typing...
          </span>
        )}
        {/* Back to Home Button */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 mt-5"
        >
          <motion.a
            href="/about"
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-blue-500/30"
          >
            <MessageSquare className="mr-2 h-5 w-5" />
            About Us
          </motion.a>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-gray-900 flex overflow-hidden">
      {/* Overlay for mobile */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-20 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {(showSidebar || window.innerWidth > 768) && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="fixed md:relative inset-y-0 left-0 w-[280px] bg-gray-800 border-r border-gray-700 z-30 flex flex-col"
          >
            <div className="h-14 flex items-center justify-between px-4 border-b bg-gray-800">
              <div className="flex items-center gap-2">
                <Bot className="text-blue-500" size={22} />
                <h2 className="text-base font-semibold text-white">Electro Circuit AI</h2>
              </div>
              <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 hover:bg-gray-700 rounded-lg">
                <X className="text-gray-400" size={20} />
              </button>
            </div>

            <div className="p-3 border-b border-gray-700">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleNewChatClick}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center justify-center gap-2 text-sm font-medium transition-colors"
              >
                <Plus size={18} />
                <span>New Chat</span>
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className="group relative flex items-center gap-2 p-2 hover:bg-gray-700 rounded-lg cursor-pointer"
                >
                  <div
                    className={`flex-1 flex items-center gap-2 ${
                      activeChatId === chat.id ? "text-blue-500" : "text-gray-300"
                    }`}
                    onClick={() => switchChat(chat.id)}
                  >
                    <MessageCircle size={18} />
                    <span className="text-sm font-medium truncate">{chat.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingChatId(chat.id);
                        setEditChatTitle(chat.name);
                        setShowEditDialog(true);
                      }}
                      className="p-1 hover:bg-gray-600 rounded"
                    >
                      <Edit size={16} className="text-gray-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      className="p-1 hover:bg-gray-600 rounded"
                    >
                      <Trash2 size={16} className="text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {renderChatHeader()}

        {/* Chat Messages */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="m-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div
            ref={chatContainerRef}
            className="h-[calc(100vh-8.5rem)] overflow-y-auto px-4 py-6"
            onScroll={() => {
              if (chatContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
                setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
              }
            }}
          >
            {chatHistory.length === 0 && !isLoading ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="h-full flex flex-col items-center justify-center text-center px-4"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                    rotate: [0, 3, -3, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "reverse",
                  }}
                  className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-6"
                >
                  <Bot className="text-white" size={32} />
                </motion.div>
                <h3 className="text-xl font-semibold text-white mb-2">Welcome to AI Chat!</h3>
                <p className="text-sm text-gray-400 max-w-sm mb-6">
                  Start a conversation by typing a message below. Our AI is ready to assist you.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
                  onClick={() => setMessage("Hello, AI! What can you help me with today?")}
                >
                  Start Chatting
                </motion.button>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((chat, index) => (
                  <motion.div
                    key={index}
                    initial="hidden"
                    animate="visible"
                    variants={messageVariants}
                    className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex items-end gap-2 max-w-[85%] lg:max-w-[75%] ${
                        chat.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          chat.role === "user" ? "bg-blue-600" : "bg-gray-700"
                        }`}
                      >
                        {chat.role === "user" ? (
                          <User className="text-white" size={16} />
                        ) : (
                          <Bot className="text-gray-400" size={16} />
                        )}
                      </div>
                      <div className={chat.role === "user" ? "items-end" : "items-start"}>
                        <div
                          className={`rounded-2xl text-sm ${
                            chat.role === "user"
                              ? "bg-blue-600 text-white rounded-br-none p-3"
                              : "bg-gray-700 text-gray-200 rounded-bl-none"
                          }`}
                        >
                          {chat.role === "user" ? (
                            <p>{chat.content}</p>
                          ) : (
                            <div className="overflow-hidden">
                              {formatBotResponse(chat.content).map((segment, idx) => {
                                if (segment.type === 'code') {
                                  return (
                                    <CodeBlock
                                      key={idx}
                                      language={segment.language}
                                      content={segment.content}
                                    />
                                  );
                                } else if (segment.type === 'link') {
                                  return (
                                    <a
                                      key={idx}
                                      href={segment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 bg-gray-800 px-2 py-1 rounded-md hover:bg-gray-700 transition-colors"
                                    >
                                      {segment.text}
                                      <ExternalLink size={12} />
                                    </a>
                                  );
                                } else {
                                  return <TextSegment key={idx} content={segment.content} />;
                                }
                              })}
                            </div>
                          )}
                        </div>
                        <div
                          className={`flex items-center gap-1 mt-1 text-xs text-gray-500 ${
                            chat.role === "user" ? "justify-end" : ""
                          }`}
                        >
                          <Clock size={10} />
                          {formatTime(chat.timestamp)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-sm text-gray-500"
                  >
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.4, 1, 0.4],
                          }}
                          transition={{
                            duration: 1,
                            delay: i * 0.2,
                            repeat: Number.POSITIVE_INFINITY,
                          }}
                          className="w-2 h-2 bg-blue-500 rounded-full"
                        />
                      ))}
                    </div>
                    <span>AI is typing...</span>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="p-4 bg-gray-800 border-t border-gray-700">
            <motion.form
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onSubmit={handleSendMessage}
              className="flex gap-2 relative"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setIsTyping(true);
                    clearTimeout(typingTimeout.current);
                    typingTimeout.current = setTimeout(() => setIsTyping(false), 1000);
                  }}
                  className="w-full px-4 py-2 bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-white"
                  placeholder="Type your message..."
                  disabled={isLoading}
                />
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -top-6 left-4 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded border"
                  >
                    Typing...
                  </motion.div>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading || !message.trim()}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                  isLoading || !message.trim()
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                <Send size={16} className={isLoading ? "opacity-50" : ""} />
                <span className="hidden sm:inline">Send</span>
              </motion.button>
            </motion.form>
          </div>
        </div>

        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-20 right-4 p-2 bg-gray-800 rounded-full shadow-lg border hover:shadow-xl"
            onClick={scrollToBottom}
          >
            <ChevronDown size={20} className="text-gray-400" />
          </motion.button>
        )}
      </div>
      {renderNewChatDialog()}
      {renderEditDialog()}
    </div>
  );
}

export default Home;
