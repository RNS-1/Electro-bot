import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect, createContext } from "react";
import Home from "./pages/Home";
import About from "./pages/About"; // Correct the import statement
import { Toaster } from 'react-hot-toast';

// Create auth context
export const AuthContext = createContext(null);

function App() {
  const [username, setUsername] = useState(localStorage.getItem("username"));
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem("isAdmin") === "true");
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("token"));

  // Function to handle login
  
  // Function to handle logout
  
  return (
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/about" element={<About />} /> {/* Correct the element */}
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          
        </Routes>
      </Router>
  );
}

export default App;
