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
GEMINI_API_KEY = "AIzaSyBSQuSk_e9UHjWba-Kw89Xd-KjU8o2keBo"  # Replace with your actual API key
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
        prompt = f"""You are an expert electrical circuit diagram generator.
        Your sole purpose is to produce clear and accurate diagrams for any valid
        electrical circuit description provided by the user. You will also explain
        the components and working of the circuit and provide an estimated price
        for the project. Ensure that the components in the diagram are represented
        with their symbols and labels as requested:

        Components (Symbols + Labels)
        Every circuit consists of electronic components. Each should have:

        Symbol: Resistor (zigzag), capacitor (parallel lines), inductor (coils),
                diode (triangle with line), LED (diode with arrows), switch (open/closed gap),
                battery (long and short parallel lines), ground (downward pointing lines),
                IC (rectangle with pin numbers), etc.
        Label: Like R1, C1, L1, D1, LED1, SW1, V1, GND, U1, etc.
        Value/Specification: e.g., 10kΩ, 100nF, 10mH, 1N4001, 20mA, SPST, 9V,
                              GND, LM317, etc.

        If the user's message describes an electrical circuit, generate:
        1. A diagram in a text-based format that is easy to understand, including
           symbols, labels, and values/specifications for each component. Clearly
           label components and connections.
        2. An explanation of each component used in the circuit.
        3. A description of how the circuit works.
        4. An estimated price for all the components required for this project.
        6.Make Sure the diagram is in a text-based format that is easy to understand.
        7.diagram Should be Neat and Good to See
        8. make no / in the Diagram

        If the user's message is not related to electrical circuits or is ambiguous,
        respond with a polite message indicating that you can only generate
        electrical circuit diagrams, explain their components and working, and
        provide a price estimate.

        User's Input:
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