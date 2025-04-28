import streamlit as st
import os
import logging
import base64
from datetime import datetime
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# Set up page configuration
st.set_page_config(
    page_title="Text & Diagram Generator",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Session state initialization
if 'generation_history' not in st.session_state:
    st.session_state.generation_history = []

# Set up API key - from secrets or environment
def get_api_key():
    # Try to get from Streamlit secrets (preferred for deployment)
    # if 'GEMINI_API_KEY' in st.secrets:
    #     return st.secrets['GEMINI_API_KEY']
    # Otherwise try environment variable
    api_key = os.environ.get("GEMINI_API_KEY")
    # If still no API key, allow user input
    if not api_key:
        if 'api_key' not in st.session_state:
            st.session_state.api_key = ""
        
        api_key = st.sidebar.text_input(
            "Enter your Gemini API Key:",
            value=st.session_state.api_key,
            type="password"
        )
        if api_key:
            st.session_state.api_key = api_key
    
    return api_key

# Function to configure Gemini
def setup_gemini(api_key):
    if not api_key:
        st.error("Please provide a valid Gemini API key")
        return None
    
    try:
        genai.configure(api_key=api_key)
        
        # Create generation config
        generation_config = {
            "temperature": 0.7,
            "top_p": 1,
            "top_k": 32,
            "max_output_tokens": 4096,
        }
        
        # Set safety settings
        safety_settings = {
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        }
        
        # Initialize model - using gemini-1.5-pro for both text and diagrams
        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        
        return model
    
    except Exception as e:
        st.error(f"Error setting up Gemini: {str(e)}")
        logger.error(f"Gemini setup error: {str(e)}")
        return None

# Enhanced circuit diagram prompt template with improved diagram instructions
def create_circuit_diagram_prompt(user_message):
    return f"""
You are an expert **Electrical Circuit Diagram Generator**.

Your primary task is to generate **clear, accurate, and professional-quality text-based circuit diagrams** from user-provided descriptions. You must also provide a detailed explanation of each component, describe how the circuit operates, and estimate the total cost of the project.

Respond only to valid electrical/electronic circuit descriptions. If the input is not related, reply with a polite message explaining your purpose.

---

## 📐 Output Format

### 1. Circuit Diagram (Enhanced ASCII/Unicode Format)
- Draw the circuit using a rich set of ASCII/Unicode symbols for better visualization:
  - Resistors: `-www-` or `-[R]-`
  - Capacitors: `-||-` or `-|⊥-` 
  - Inductors: `-mmm-` or `-ᗜᗜᗜ-`
  - Diodes: `-|>|-`
  - LEDs: `-|>|*-`
  - Transistors (NPN): `    c
      |
    --b
      |
      e`
  - Power sources: `-⎓-` or `+[BAT]-`
  - Ground: `-⏚-` or `-⊥-`
  - Switches: `-o/o-` or `-o o-`
  - Potentiometers: `-[POT]-`
  - ICs and chips (like 555 timer): `-|555|-` or draw as box with pins
  - Wires crossing (not connected): `-+- (where + is the crossing point)
                                    |`
  - Connected wires: `-┼-` or `-┬-` or `-┴-` or `-├-` or `-┤-`

- Create clear flow paths, preferably with current flow from left-to-right or top-to-bottom
- Include arrows `→` for direction of current or signal where appropriate
- Use boxes `+-----+` to enclose logical sections of complex circuits
- Use multiple lines and proper spacing for better readability
- Add clear labels (e.g., R1, C1, LED1) and values (e.g., 10kΩ, 100nF) near each component
- Draw the circuit in monospace font for proper alignment

### 2. Component List and Descriptions
- List all components used in the diagram.
- For each component, include:
  - Full name
  - Function in the circuit
  - Specification or rating
  - Common packages or form factors (when applicable)

### 3. Circuit Operation (Working Principle)
- Describe step-by-step how the circuit works.
- Mention power flow, signal paths, triggering conditions, etc.
- Include expected behavior and outputs.
- Add notes about potential variations or improvements.

### 4. Estimated Project Cost
- List components with average price per unit.
- Show total cost of the entire project (in USD).
- Suggest alternative components where cost savings are possible.

Format your response clearly with these sections:
--- Circuit Diagram ---
[Enhanced ASCII/Unicode circuit diagram here]

--- Explanation ---
[Component list and descriptions here]

--- Working ---
[Circuit operation details here]

--- Estimated Price ---
[Cost breakdown here]

---

## User Input:
{user_message}
"""

# Function to generate content
def generate_content(model, prompt, generation_type):
    try:
        with st.spinner(f"Generating {generation_type}... This may take a moment"):
            # Generate content based on generation type
            if generation_type == "Circuit Diagram":
                full_prompt = create_circuit_diagram_prompt(prompt)
            else:  # Standard text generation
                full_prompt = prompt
            
            # Generate content
            response = model.generate_content(full_prompt)
            
            # Extract text response
            if hasattr(response, 'text'):
                response_text = response.text
                
                # Process circuit diagram response
                if generation_type == "Circuit Diagram":
                    # Parse the sections of the response
                    sections = {}
                    current_section = "preamble"
                    
                    for line in response_text.split('\n'):
                        if "--- Circuit Diagram ---" in line:
                            current_section = "diagram"
                            sections[current_section] = []
                        elif "--- Explanation ---" in line:
                            current_section = "explanation"
                            sections[current_section] = []
                        elif "--- Working ---" in line:
                            current_section = "working"
                            sections[current_section] = []
                        elif "--- Estimated Price ---" in line:
                            current_section = "price"
                            sections[current_section] = []
                        else:
                            if current_section in sections:
                                sections[current_section].append(line)
                    
                    # Convert lists to strings
                    for section in sections:
                        sections[section] = '\n'.join(sections[section])
                    
                    return {
                        'success': True,
                        'type': 'circuit_diagram',
                        'diagram': sections.get('diagram', ''),
                        'explanation': sections.get('explanation', ''),
                        'working': sections.get('working', ''),
                        'price': sections.get('price', ''),
                        'full_response': response_text
                    }
                else:
                    # Standard text response
                    return {
                        'success': True,
                        'type': 'text',
                        'response': response_text
                    }
            else:
                return {
                    'success': False,
                    'message': 'No text response generated.'
                }
    
    except Exception as e:
        logger.error(f"Content generation error: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'message': f"Error generating {generation_type.lower()}. Please check your input and API key."
        }

# Function to display circuit diagram results with font options
def display_circuit_diagram(result):
    st.subheader("📊 Circuit Diagram")
    
    # Font selection for diagram display
    font_options = ["Monospace", "Courier New", "Consolas", "Roboto Mono"]
    selected_font = st.selectbox("Select display font:", font_options, index=0)
    
    # Apply the font to the code display
    font_css = f"""
    <style>
    pre {{ 
        font-family: {selected_font}, monospace !important;
        font-size: 14px;
        line-height: 1.2;
    }}
    </style>
    """
    st.markdown(font_css, unsafe_allow_html=True)
    
    # Display the circuit diagram with copy button
    st.code(result['diagram'], language="text")
    
    # Option to view as plain text with downloadable option
    if st.checkbox("View diagram as plain text"):
        st.text_area("Circuit Diagram Text", value=result['diagram'], height=300)
        
        # Create download button for diagram
        diagram_bytes = result['diagram'].encode()
        b64 = base64.b64encode(diagram_bytes).decode()
        href = f'<a href="data:text/plain;base64,{b64}" download="circuit_diagram.txt">Download Circuit Diagram</a>'
        st.markdown(href, unsafe_allow_html=True)
    
    # Create tabs for explanation, working, and price
    tab1, tab2, tab3 = st.tabs(["Components & Explanation", "Working Principle", "Cost Estimate"])
    
    with tab1:
        st.markdown(result['explanation'])
    
    with tab2:
        st.markdown(result['working'])
    
    with tab3:
        st.markdown(result['price'])
    
    # Add to history
    add_to_history("Circuit Diagram", result['diagram'], result['full_response'])

# Function to display text results
def display_text_result(result):
    st.subheader("📝 Generated Text")
    st.markdown(result['response'])
    
    # Add to history
    add_to_history("Text", result['response'])

# Function to add to history
def add_to_history(gen_type, content, full_content=None):
    timestamp = datetime.now().strftime("%H:%M:%S")
    st.session_state.generation_history.append({
        'timestamp': timestamp,
        'type': gen_type,
        'content': content,
        'full_content': full_content or content
    })

# UI Elements
st.title("⚡ Electrical Circuit Diagram & Text Generator")
st.markdown("Generate electrical circuit diagrams or text responses using Gemini AI")

# Get API key and setup model
api_key = get_api_key()
model = setup_gemini(api_key) if api_key else None

# Create columns for input and history
col1, col2 = st.columns([3, 1])

with col1:
    # Create UI for content generation
    if model:
        # Generation type selector
        generation_type = st.radio(
            "What would you like to generate?",
            ["Text", "Circuit Diagram"],
            horizontal=True
        )
        
        description_text = ""
        if generation_type == "Circuit Diagram":
            description_text = "Describe the electrical circuit you want to generate:"
            placeholder_text = "Example: A simple LED flasher circuit using 555 timer with adjustable frequency"
        else:
            description_text = "Enter your prompt for text generation:"
            placeholder_text = "Example: Explain how transistors work in simple terms"
        
        with st.form("generation_form"):
            user_prompt = st.text_area(
                description_text,
                height=150,
                placeholder=placeholder_text
            )
            
            # Advanced options expander
            with st.expander("Advanced Options"):
                if generation_type == "Circuit Diagram":
                    diagram_style = st.radio(
                        "Diagram Style:",
                        ["Standard ASCII", "Enhanced Unicode", "Detailed"],
                        horizontal=True
                    )
                    
                    detail_level = st.slider(
                        "Detail Level:",
                        min_value=1,
                        max_value=5,
                        value=3,
                        help="Controls the level of detail in the generated diagram"
                    )
                else:
                    # Text generation options
                    response_length = st.radio(
                        "Response Length:",
                        ["Concise", "Standard", "Detailed"],
                        index=1,
                        horizontal=True
                    )
            
            # Form submit button
            submit_button = st.form_submit_button(f"Generate {generation_type}")
            
            if submit_button and user_prompt:
                # Call the generation function
                result = generate_content(model, user_prompt, generation_type)
                
                if result['success']:
                    if generation_type == "Circuit Diagram" and result['type'] == 'circuit_diagram':
                        display_circuit_diagram(result)
                    else:
                        display_text_result(result)
                else:
                    # Display error message
                    st.error(result.get('message', f'Failed to generate {generation_type.lower()}'))
            elif submit_button:
                st.warning(f"Please enter a {'circuit description' if generation_type == 'Circuit Diagram' else 'prompt'} first.")
    else:
        st.info("Please provide a valid Gemini API key in the sidebar to start generating content.")

    # Display examples if no history
    if not st.session_state.generation_history:
        with st.expander("📚 Example Prompts"):
            st.markdown("""
            ### Circuit Diagram Examples:
            - A simple LED circuit with a 9V battery, resistor, and switch
            - 555 timer-based LED flasher with adjustable frequency
            - Arduino-controlled temperature sensor with LCD display
            - Solar-powered battery charger circuit with overcharge protection
            - H-bridge motor control circuit using MOSFETs
            - ESP32-based WiFi relay controller with smartphone app interface
            - Three-stage audio amplifier with tone control
            - Automated plant watering system with soil moisture sensor
            
            ### Text Generation Examples:
            - Explain how transistors work to a 10-year-old
            - What are the differences between DC and AC motors?
            - List common troubleshooting steps for electronic circuits
            - History of integrated circuits and their impact on technology
            - Compare microcontroller platforms for beginners (Arduino vs Raspberry Pi)
            - Explain PWM motor control techniques and applications
            - How do switching power supplies work compared to linear regulators?
            - Describe modern approaches to PCB design for noise reduction
            """)

# History sidebar
with col2:
    st.subheader("Generation History")
    
    if not st.session_state.generation_history:
        st.info("Your generation history will appear here")
    else:
        for i, item in enumerate(reversed(st.session_state.generation_history)):
            with st.expander(f"{item['timestamp']} - {item['type']}"):
                if item['type'] == "Circuit Diagram":
                    st.code(item['content'], language="text")
                    if st.button("View Full Details", key=f"view_{i}"):
                        st.markdown(item['full_content'])
                else:
                    st.markdown(item['content'])
        
        if st.button("Clear History"):
            st.session_state.generation_history = []
            st.experimental_rerun()

# Sidebar information
with st.sidebar:
    st.subheader("About")
    st.markdown("""
    This app uses Google's Gemini AI to generate:
    
    1. **Electrical Circuit Diagrams** - Text-based representations of circuits with explanations
    2. **Text Responses** - Standard text generation for queries and explanations
    
    To use this app:
    1. Enter your Gemini API key
    2. Select the type of content you want to generate
    3. Enter a circuit description or text prompt
    4. Click the Generate button
    """)
    
    st.subheader("Circuit Diagram Features")
    st.markdown("""
    For circuit diagrams, the app will generate:
    - ASCII/Unicode circuit diagram with component labels
    - Component list with detailed descriptions
    - Working principle explanation with step-by-step analysis
    - Cost estimate with alternative suggestions
    
    The enhanced diagrams use special symbols to represent:
    - Resistors, capacitors, inductors, diodes, LEDs
    - Transistors, ICs, power sources, ground connections
    - Switches, potentiometers, and other components
    - Signal flow directions and connections
    """)
    
    # New help section for reading diagrams
    with st.expander("How to Read ASCII Circuit Diagrams"):
        st.markdown("""
        ### Reading ASCII Circuit Diagrams:
        
        - **Connections**: Lines made with `-`, `|`, and connecting symbols
        - **Components**: Special symbols between connection lines
        - **Signal Flow**: Generally left-to-right or top-to-bottom
        - **Labels**: Component identifiers (R1, C1) with values
        - **Ground**: Usually shown as `⏚` or `⊥` symbols
        - **Power**: Often at the top/left of diagrams
        
        ### Common Symbols:
        ```
        Resistor:    -www-  or -[R]-
        Capacitor:   -||-   or -|⊥-
        Diode:       -|>|-
        LED:         -|>|*-
        Transistor:  -|>-  (simplified)
        Switch:      -o/o-  or -o o-
        Ground:      -⏚-    or -⊥-
        ```
        """)
    
    st.subheader("Settings")
    if st.button("Clear API Key", key="clear_api"):
        st.session_state.api_key = ""
        st.experimental_rerun()