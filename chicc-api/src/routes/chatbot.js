const express = require('express');
const router = express.Router();
const Replicate = require('replicate');
const fetch = require('node-fetch'); // if not global in your Node

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// Fetch all products from your existing products API
async function getAllProducts() {
    const res = await fetch('https://chicapi.onrender.com/api/v1/products');
    return res.json();
}

function findRelevantProducts(question, products) {
    const keywords = question.toLowerCase().split(/\W+/);
    return products.filter(prod =>
        keywords.some(kw =>
            prod.type.toLowerCase().includes(kw) ||
            (prod.brand && prod.brand.toLowerCase().includes(kw)) ||
            (prod.description && prod.description.toLowerCase().includes(kw))
        )
    ).slice(0, 8);
}

// POST /api/chatbot
router.post('/', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const products = await getAllProducts();
        const relevant = findRelevantProducts(prompt, products);
        const productInfo = relevant.map(p =>
            `${p.brand ? p.brand + ' ' : ''}${p.type} - $${p.price}: ${p.description || ''}`
        ).join('\n');

        const systemPrompt = "You are a helpful shopping assistant for the CHIC online store.";
        const fullPrompt = `${systemPrompt}\nHere are some products:\n${productInfo}\n\nUser: ${prompt}\nAssistant:`;

        let outputText = '';
        const input = { prompt: fullPrompt, max_new_tokens: 300 };

        for await (const event of replicate.stream("meta/meta-llama-3-8b-instruct", { input })) {
            outputText += event;
        }

        return res.json({ output: outputText.trim() });

    } catch (err) {
        console.error('Chatbot error:', err);
        return res.status(500).json({ error: 'Failed to get chatbot answer.' });
    }
});

module.exports = router;
