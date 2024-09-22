const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const LLAMA_API_URL = "https://phi.us.gaianet.network/v1/chat/completions";

// Questions to ask the user
const tripQuestions = [
  "What is your destination?",
  "What type of vacation are you looking for?",
  "What kind of weather do you prefer?",
  "How many days are you planning for?",
  "What is your budget?",
  "Can you describe your ideal vacation in a few words?",
  "What is your preferred mode of travel to the destination?",
  "How do you plan to get around the destination?",
  "How many people are traveling?",
  "What type of accommodation do you prefer?",
  "Any special interests or activities you want to focus on?",
  "Any dietary preferences or restrictions?"
];

// Response keys to store answers meaningfully
const responseKeys = [
  'destinationAnswer',
  'vacationTypeAnswer',
  'weatherAnswer',
  'daysAnswer',
  'budgetAnswer',
  'idealVacationAnswer',
  'travelModeAnswer',
  'localTravelAnswer',
  'numberOfPeopleAnswer',
  'accomodationAnswer',
  'interestAnswer',
  'dietAnswer'
];

let userResponses = {};
let currentQuestionIndex = 0;

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;

  // First question: If no message and at the beginning of the conversation
  if (!userMessage && currentQuestionIndex === 0) {
    return res.json({ message: tripQuestions[currentQuestionIndex] });
  }

  // Handle case where the user does not provide a message
  if (!userMessage) {
    return res.status(400).json({ error: "Message is required" });
  }

  // If questions remain, store the response and move to the next question
  if (currentQuestionIndex < tripQuestions.length) {
    userResponses[responseKeys[currentQuestionIndex]] = userMessage;
    currentQuestionIndex++;

    // Send the next question
    if (currentQuestionIndex < tripQuestions.length) {
      return res.json({ message: tripQuestions[currentQuestionIndex] });
    } else {
      // All questions answered, compile the information for LLM
      const compiledInfo = `
You are a trip planning expert which prepares a day-to-day itinerary of the trip for the user. Your answering format should follow this template:
Date: "Provide the date"
Hotel Recommendation: "Provide hotel recommendation"
Morning:
  Time: "Provide time" | Activity: "Provide activity"
Afternoon:
  Time: "Provide time" | Activity: "Provide activity"
Evening:
  Time: "Provide time" | Activity: "Provide activity"

A person wants to go to "${userResponses.destinationAnswer}" and have a "${userResponses.vacationTypeAnswer}" type of vacation. Plan the trip when the weather is "${userResponses.weatherAnswer}" and make it "${userResponses.daysAnswer}" days long. The budget is "${userResponses.budgetAnswer}" INR. This person is looking for an experience like this: "${userResponses.idealVacationAnswer}". The preferred mode of travel to the destination is "${userResponses.travelModeAnswer}" and preferred mode of local travel to go around the destination is "${userResponses.localTravelAnswer}". "${userResponses.numberOfPeopleAnswer}" people are going on the trip. 

Give recommendations for "${userResponses.accomodationAnswer}" type of accommodation at the destination. Include "${userResponses.interestAnswer}" in the day-to-day trip plan. The places to eat should follow their preferences: "${userResponses.dietAnswer}".
      `;

      // Send the compiled info to the external LLM API
      try {
        const response = await axios.post(
          LLAMA_API_URL,
          {
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: compiledInfo }
            ]
          },
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            }
          }
        );

        // Ensure proper formatting of the final response
        let aiResponse = response.data.choices[0].message.content.trim();

        // Replace '|' with '<br>' for line breaks
        let formattedResponse = aiResponse
          .replace(/\*\*/g, '<br>')
          .replace(/###/g, '<br>')
          .replace(/####/g, '<br>');
        formattedResponse = formattedResponse.replace(/(Date:\s[\w\s,]+)/g, '<b>$1</b><br>');
        formattedResponse = formattedResponse
        .replace(/\b(Morning|Afternoon|Evening)\b/g, '<br><b>$1</b>')
        .replace(/Time:/g, '<br>Time:')
        .replace(/Activity:/g, '<br>Activity:');
        formattedResponse = formattedResponse.replace(/\*(.*?)\*/g, '<i>$1</i>');
        res.json({ message: formattedResponse });
      } catch (error) {
        console.error("Error communicating with the Gaia API:", error.response?.data || error.message);
        res.status(500).json({ error: "Error communicating with the Gaia API" });
      }

      // Reset for next session
      currentQuestionIndex = 0;
      userResponses = {};
    }
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
