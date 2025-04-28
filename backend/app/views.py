import json
import os
import logging
from datetime import datetime

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from pymongo import MongoClient

import google.generativeai as genai

# Set up logging
logger = logging.getLogger(__name__)

# Configure the Gemini API
GEMINI_API_KEY = "AIzaSyApb3uEAndgRMBIvIYGULdoO3xFcYcYJeU"  # Replace with your actual API key
genai.configure(api_key=GEMINI_API_KEY)

# Set up the model
model = genai.GenerativeModel('gemini-1.5-pro')

@csrf_exempt
@require_POST
def chatbot_view(request):
    try:
        data = json.loads(request.body)
        user_message = data.get('message', '')
        message_history = data.get('history', [])

        chat_history = message_history if message_history else []

        # Define the prompt to instruct Gemini to produce diagrams for electrical circuits
        prompt = f"""
You are an expert **Electrical Circuit Diagram Generator**.

Your primary task is to generate **clear, accurate, and professional-quality text-based circuit diagrams** from user-provided descriptions. You must also provide a detailed explanation of each component, describe how the circuit operates, and estimate the total cost of the project.

Respond only to valid electrical/electronic circuit descriptions. If the input is not related, reply with a polite message explaining your purpose.

---

## 📐 Output Format

### 1. Circuit Diagram (ASCII Text Format)
- Draw the circuit using standard ASCII symbols and proper layout.
- Use only `-`, `|`, `+`, and space for structure. **Do not use slashes (`/`)**.
- Neatly align all components. Maintain logical left-to-right or top-down flow.
- Each component must include:
  - A symbol
  - A label (e.g., R1, C1, LED1)
  - A specification or value (e.g., 10kΩ, 100nF)

### 2. Component List and Descriptions
- List all components used in the diagram.
- For each component, include:
  - Full name
  - Function in the circuit
  - Specification or rating

### 3. Circuit Operation (Working Principle)
- Describe step-by-step how the circuit works.
- Mention power flow, signal paths, triggering conditions, etc.

### 4. Estimated Project Cost
- List components with average price per unit.
- Show total cost of the entire project (in USD).

---

## 🧰 Component Symbol Reference

| Component     | ASCII Symbol Format        | Example Label     |
|---------------|-----------------------------|--------------------|
| Resistor      | `--^^^--`                   | R1: 10kΩ           |
| Capacitor     | `--||--`                    | C1: 100nF          |
| Inductor      | `--(coil)--`                | L1: 10mH           |
| Diode         | `-->|--`                    | D1: 1N4007         |
| LED           | `-->|→→`                    | LED1: Red, 2V      |
| Switch        | `--o o--` (open/closed)     | SW1: SPST          |
| Battery       | `+ | | -`                   | V1: 9V             |
| Ground        | `--|||`                     | GND                |
| IC            | `[U1]` with pins shown      | U1: LM358          |
| Transistor    | B, C, E labeled explicitly  | Q1: BC547          |

---

## ❌ Invalid Input Response

If the input is not a valid electrical circuit description, respond with:
> “I specialize in generating and explaining electrical circuit diagrams. Please provide a valid circuit or project description for me to assist you.”

---

## 📥 User Input:
{user_message}
"""


        chat = model.start_chat(history=chat_history)
        response = chat.send_message(prompt)

        # Split the response into diagram, explanation, working, and price (if possible)
        parts = response.text.split("--- Explanation ---")
        diagram = parts[0].strip()
        explanation_working_price = parts[1].strip() if len(parts) > 1 else ""
        sub_parts = explanation_working_price.split("--- Working ---")
        explanation = sub_parts[0].strip() if len(sub_parts) > 0 else ""
        working_price = sub_parts[1].strip() if len(sub_parts) > 1 else ""
        final_parts = working_price.split("--- Estimated Price ---")
        working = final_parts[0].strip() if len(final_parts) > 0 else ""
        price = final_parts[1].strip() if len(final_parts) > 1 else ""

        return JsonResponse({
            'diagram': diagram,
            'explanation': explanation,
            'working': working,
            'price': price,
            'response': response.text, # Keep the full response for debugging if needed
            'success': True
        })

    except Exception as e:
        logger.error(f"Chatbot error: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e),
            'response': "I'm sorry, I encountered an error while trying to generate the diagram, explanation, working, and price. Please ensure your description is a valid electrical circuit and try again later."
        }, status=500)
