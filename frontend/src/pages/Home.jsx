import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Send, Info, FileText, Trash2, Download, Copy, Bookmark, Moon, Sun, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-modal';

// Common modal styles to avoid repetition
const modalStyles = {
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    position: 'relative',
    top: 'auto',
    left: 'auto',
    right: 'auto',
    bottom: 'auto',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    border: 'none',
    background: 'none',
    padding: 0
  }
};

// List of sample recommendations - moved outside to reduce component size
const sampleRecommendations = [
  "Generate a simple LED circuit",
  "Create a voltage divider circuit",
  "Design a 555 timer circuit",
  "Design a full-wave bridge rectifier",
  "Create a basic Arduino circuit",
  "Design a push-button LED circuit",
  "Generate a photoresistor light sensor circuit",
  "Design a temperature sensor circuit",
  "Create a basic motor driver circuit",
  "How to build a capacitor filter circuit",
  "Design a microphone preamp circuit",
  "Create a DC power supply circuit",
  "Generate a voltage regulator circuit",
  "Design a relay switch circuit",
  "How to build an IR sensor circuit",
  "Create a Bluetooth control circuit",
  "Design a WiFi-controlled relay circuit",
  "Create a touch sensor circuit",
  "Design a multiplexer circuit"
];

// Helper components to reduce main component complexity
const ChatMessage = ({ session, darkMode, copyToClipboard, bookmarkConversation }) => (
  <div className="chat-message">
    
  </div>
);

const RecommendationsPanel = ({ recommendations, useRecommendation, darkMode }) => (
  <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
    <div className="flex items-center mb-2">
      <Zap size={16} className={darkMode ? 'text-blue-400 mr-2' : 'text-blue-600 mr-2'} />
      <h3 className={`font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Try asking about:</h3>
    </div>
    <div className="grid grid-cols-1 gap-2">
      {recommendations.map((rec, index) => (
        <button
          key={index}
          onClick={() => useRecommendation(rec)}
          className={`text-left p-2 rounded-md transition-all duration-300 text-sm ${
            darkMode 
              ? 'bg-blue-900/20 hover:bg-blue-800/40 text-blue-300' 
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
          }`}
        >
          {rec}
        </button>
      ))}
    </div>
  </div>
);

const ChatBot = () => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [output, setOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const outputContentRef = useRef(null);
  const navigate = useNavigate();

  // Load stored data on component mount
  useEffect(() => {
    const storedHistory = JSON.parse(sessionStorage.getItem('chatHistory')) || [];
    const storedBookmarks = JSON.parse(localStorage.getItem('chatBookmarks')) || [];
    const storedTheme = localStorage.getItem('theme') || 'dark';
    
    setHistory(storedHistory);
    setBookmarks(storedBookmarks);
    setDarkMode(storedTheme === 'dark');
    
    // Generate random recommendations
    const randomRecommends = getRandomRecommendations(sampleRecommendations, 5);
    setRecommendations(randomRecommends);
  }, []);

  // Get random recommendations
  const getRandomRecommendations = (list, count) => {
    const shuffled = [...list].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Save data when it changes
  useEffect(() => {
    sessionStorage.setItem('chatHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('chatBookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    document.body.className = darkMode ? 'bg-black' : 'bg-gray-100';
  }, [darkMode]);

  // Auto-scroll to bottom of output when new content is added
  useEffect(() => {
    if (outputContentRef.current) {
      outputContentRef.current.scrollTop = outputContentRef.current.scrollHeight;
    }
  }, [output]);

  const formatBotResponse = (text) => {
    let formattedText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-500 hover:underline transition-colors duration-300">$1</a>');
    formattedText = formattedText.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-gray-800 text-white p-4 rounded-lg my-2 overflow-x-auto"><code>$2</code></pre>');
    formattedText = formattedText.replace(/`([^`]+)`/g, '<code class="bg-gray-800 text-blue-400 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    formattedText = formattedText.replace(/^### (.*?)$/gm, '<h3 class="text-lg font-bold my-2 text-blue-400">$1</h3>');
    formattedText = formattedText.replace(/^## (.*?)$/gm, '<h2 class="text-xl font-bold my-3 text-blue-400">$1</h2>');
    formattedText = formattedText.replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold my-4 text-blue-400">$1</h1>');
    formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-blue-500">$1</strong>');
    formattedText = formattedText.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    formattedText = formattedText.replace(/^\- (.*?)$/gm, '<li class="ml-4 list-disc">$1</li>');
    formattedText = formattedText.replace(/^(?!<[uo]l|<li|<h[1-6]|<pre|<code)(.+)$/gm, '<p class="my-2">$1</p>');
    return formattedText;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsTyping(true);
    setOutput(''); // Clear previous output
    setErrorMessage('');

    const userMessage = { text: input, sender: 'user', id: Date.now() };
    setInput('');

    try {
      const response = await fetch('http://127.0.0.1:8000/api/chatbot/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, history: [] })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      const botMessage = { text: formatBotResponse(data.response), sender: 'bot', id: Date.now() };
      setOutput(botMessage.text); // Set the output
      setHistory((history) => [...history, { userMessage, botMessage }]);
      
      // Refresh recommendations after a message
      const newRecommendations = getRandomRecommendations(sampleRecommendations, 5);
      setRecommendations(newRecommendations);
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('Connection failed. Please check your internet connection and try again.');
      const errorMessage = { 
        text: 'Sorry, I encountered an error. Please check your connection and try again later.', 
        sender: 'bot', 
        id: Date.now() 
      };
      setOutput(errorMessage.text); // Set the error output
      setHistory((history) => [...history, { userMessage, botMessage: errorMessage }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Utility functions
  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear your chat history?')) {
      setHistory([]);
      sessionStorage.removeItem('chatHistory');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text.replace(/<[^>]*>/g, ''))
      .then(() => alert('Copied to clipboard!'))
      .catch(err => console.error('Failed to copy: ', err));
  };

  const downloadHistory = () => {
    const historyText = history.map(session => (
      `User: ${session.userMessage.text}\n\nElectro Nexus Bot: ${session.botMessage.text.replace(/<[^>]*>/g, '')}\n\n---\n\n`
    )).join('');
    
    const blob = new Blob([historyText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const bookmarkConversation = (session) => {
    const isAlreadyBookmarked = bookmarks.some(b => 
      b.userMessage.id === session.userMessage.id && 
      b.botMessage.id === session.botMessage.id
    );

    if (!isAlreadyBookmarked) {
      setBookmarks([...bookmarks, { ...session, bookmarkedAt: Date.now() }]);
    } else {
      alert('This conversation is already bookmarked');
    }
  };

  const removeBookmark = (index) => {
    const newBookmarks = [...bookmarks];
    newBookmarks.splice(index, 1);
    setBookmarks(newBookmarks);
  };

  const useRecommendation = (text) => {
    setInput(text);
    inputRef.current.focus();
  };

  return (
    <div className={`flex flex-col md:flex-row h-screen ${darkMode ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'}`}>
      {/* Left Panel */}
      <div className={`w-full md:w-1/2 p-4 ${darkMode ? 'border-r border-blue-600' : 'border-r border-blue-300'} flex flex-col`}>
        <header className="flex justify-between items-center mb-4">
          <div className={`font-bold text-xl ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            Electro Circuit Generator
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className={`p-2 rounded ${darkMode ? 'hover:bg-blue-800/30 text-blue-400' : 'hover:bg-blue-200 text-blue-600'}`} 
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={() => navigate('/about')} 
              className={`p-2 rounded ${darkMode ? 'hover:bg-blue-800/30 text-blue-400' : 'hover:bg-blue-200 text-blue-600'}`} 
              title="About Us"
            >
              <Info size={20} />
            </button>
          </div>
        </header>

        <RecommendationsPanel 
          recommendations={recommendations} 
          useRecommendation={useRecommendation} 
          darkMode={darkMode} 
        />

        <div className="flex-1 overflow-y-auto mb-4 pr-2 custom-scrollbar" ref={outputRef}>
          <div className="space-y-4">
            {history.map((session, index) => (
              <ChatMessage 
                key={index} 
                session={session} 
                darkMode={darkMode}
                copyToClipboard={copyToClipboard}
                bookmarkConversation={bookmarkConversation}
              />
            ))}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex">
          <div className="flex relative w-full">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className={`w-full p-3 pr-16 rounded ${
                darkMode 
                  ? 'bg-gray-900 text-white border border-blue-600 focus:border-blue-400' 
                  : 'bg-white text-gray-800 border border-blue-300 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all`}
            />
            <button
              type="submit"
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded ${
                !input.trim() || isTyping 
                  ? 'opacity-50 cursor-not-allowed' 
                  : darkMode 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              disabled={!input.trim() || isTyping}
            >
              {isTyping ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </form>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-1/2 p-4 flex flex-col">
        <header className="flex justify-between items-center mb-4">
          <div className={`font-bold text-xl ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            Output
          </div>
          <div className="flex space-x-2">
            <button onClick={() => setIsBookmarksOpen(true)} className={`p-2 rounded ${darkMode ? 'hover:bg-blue-800/30 text-blue-400' : 'hover:bg-blue-200 text-blue-600'}`} title="Bookmarks">
              <Bookmark size={20} />
            </button>
            <button onClick={() => setIsHistoryOpen(true)} className={`p-2 rounded ${darkMode ? 'hover:bg-blue-800/30 text-blue-400' : 'hover:bg-blue-200 text-blue-600'}`} title="View History">
              <FileText size={20} />
            </button>
            <button onClick={downloadHistory} className={`p-2 rounded ${darkMode ? 'hover:bg-blue-800/30 text-blue-400' : 'hover:bg-blue-200 text-blue-600'}`} title="Download History">
              <Download size={20} />
            </button>
            <button onClick={clearHistory} className={`p-2 rounded ${darkMode ? 'hover:bg-blue-800/30 text-blue-400' : 'hover:bg-blue-200 text-blue-600'}`} title="Clear History">
              <Trash2 size={20} />
            </button>
          </div>
        </header>

        <div className={`flex-1 flex flex-col p-4 rounded relative overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-white shadow-md'}`}>
          {isTyping ? (
            <div className={`border-l-4 ${darkMode ? 'border-blue-400 bg-gray-800' : 'border-blue-500 bg-blue-50'} p-3 rounded self-start`}>
              <div className="flex space-x-2 animate-pulse">
                <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-blue-400' : 'bg-blue-500'}`}></div>
                <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-blue-400' : 'bg-blue-500'}`}></div>
                <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-blue-400' : 'bg-blue-500'}`}></div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col">
              {output ? (
                <div className="relative flex-1 overflow-hidden">
                  <div className="absolute top-0 right-0 z-10 flex bg-opacity-70 p-1 rounded">
                    <button 
                      onClick={() => copyToClipboard(output)} 
                      className={`p-2 rounded ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`} 
                      title="Copy to clipboard"
                    >
                      <Copy size={16} />
                    </button>
                    <button 
                      onClick={() => bookmarkConversation(history[history.length - 1])} 
                      className={`p-2 rounded ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`} 
                      title="Bookmark this conversation"
                    >
                      <Bookmark size={16} />
                    </button>
                  </div>
                  
                  <div 
                    ref={outputContentRef} 
                    className="h-full overflow-y-auto pr-2 custom-scrollbar"
                    style={{ maxHeight: 'calc(100vh - 180px)', paddingRight: '10px' }}
                  >
                    <div 
                      dangerouslySetInnerHTML={{ __html: output }} 
                      className={`${darkMode ? 'output-dark' : 'output-light'}`}
                    />
                  </div>
                </div>
              ) : (
                <div className={`text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'} flex-1 flex items-center justify-center`}>
                  <div>
                    <div className={`mx-auto w-16 h-16 mb-4 rounded-full flex items-center justify-center ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                      <Send size={24} className={darkMode ? 'text-blue-400' : 'text-blue-500'} />
                    </div>
                    <p className="text-lg">No output yet.</p>
                    <p className="text-sm">Ask me a question to begin!</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onRequestClose={() => setIsHistoryOpen(false)}
        contentLabel="Chat History"
        style={modalStyles}
      >
        <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'} max-h-[80vh] overflow-hidden flex flex-col`}>
          <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Chat History</h2>
          
          <div className="flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar">
            {history.length > 0 ? (
              history.map((session, index) => (
                <div key={index} className={`mb-4 p-3 rounded ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <div className={`font-bold text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(session.userMessage.id).toLocaleString()}
                  </div>
                  <div className={`p-2 mb-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div className="font-semibold">You:</div>
                    <div>{session.userMessage.text}</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-blue-900/20 border border-blue-900/30' : 'bg-blue-50 border border-blue-100'}`}>
                    <div className="font-semibold">Electro Nexus Bot:</div>
                    <div dangerouslySetInnerHTML={{ __html: session.botMessage.text }} />
                  </div>
                  <div className="flex justify-end mt-2 space-x-2">
                    <button onClick={() => copyToClipboard(session.botMessage.text)} className={`p-1 rounded ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-300 text-gray-600'}`}>
                      <Copy size={16} />
                    </button>
                    <button onClick={() => bookmarkConversation(session)} className={`p-1 rounded ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-300 text-gray-600'}`}>
                      <Bookmark size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-8">
                <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>No chat history yet.</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-between mt-4">
            <button 
              onClick={clearHistory} 
              className={`p-2 rounded flex items-center space-x-1 ${darkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
              disabled={history.length === 0}
            >
              <Trash2 size={16} />
              <span>Clear All</span>
            </button>
            <button 
              onClick={() => setIsHistoryOpen(false)} 
              className={`p-2 rounded ${darkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Bookmarks Modal */}
      <Modal
        isOpen={isBookmarksOpen}
        onRequestClose={() => setIsBookmarksOpen(false)}
        contentLabel="Bookmarked Conversations"
        style={modalStyles}
      >
        <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'} max-h-[80vh] overflow-hidden flex flex-col`}>
          <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Bookmarked Conversations</h2>
          
          <div className="flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar">
            {bookmarks.length > 0 ? (
              bookmarks.map((bookmark, index) => (
                <div key={index} className={`mb-4 p-3 rounded ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <div className="flex justify-between">
                    <div className={`font-bold text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Bookmarked: {new Date(bookmark.bookmarkedAt).toLocaleString()}
                    </div>
                    <button onClick={() => removeBookmark(index)} className={`p-1 rounded ${darkMode ? 'text-red-400 hover:bg-red-900/30' : 'text-red-500 hover:bg-red-100'}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className={`p-2 mt-2 mb-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div className="font-semibold">You:</div>
                    <div>{bookmark.userMessage.text}</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-blue-900/20 border border-blue-900/30' : 'bg-blue-50 border border-blue-100'}`}>
                    <div className="font-semibold">Electro Nexus Bot:</div>
                    <div dangerouslySetInnerHTML={{ __html: bookmark.botMessage.text }} />
                  </div>
                  <div className="flex justify-end mt-2">
                    <button onClick={() => copyToClipboard(bookmark.botMessage.text)} className={`p-1 rounded ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-300 text-gray-600'}`}>
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-8">
                <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>No bookmarked conversations yet.</p>
                <p className="text-sm mt-2">Click the bookmark icon to save important conversations.</p>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => setIsBookmarksOpen(false)} 
            className={`p-2 rounded mt-4 ${darkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
          >
            Close
          </button>
        </div>
      </Modal>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${darkMode ? '#1f2937' : '#f3f4f6'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${darkMode ? '#3b82f6' : '#93c5fd'};
          border-radius: 10px;
        }
        .output-dark a { color: #60a5fa; }
        .output-light a { color: #2563eb; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chat-message {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ChatBot;