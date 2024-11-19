import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url'; 
import { dirname } from 'path'; 
import {
    createEvent,
    getAllEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    getCreatedEventsByUser,
    getInvitedEventsByUser,
    addCommentToEvent,
    getCommentsForEvent,
    uploadMediaForEvent
} from '../src/firebase.mjs';

const router = express.Router();

// Directory setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Multer setup
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Route: Create an event
router.post('/CreateEvent', async (req, res) => {
    console.log(req.body); // Log the request body to inspect the data
    const { eventName, description, eventType } = req.body;
    const createdBy = req.session.user;

    // Validate the event name and description
    if (!eventName || !description) {
        return res.status(400).send("Event name and description are required.");
    }

    try {
        await createEvent({ eventName, description, isPrivate: eventType === 'on', createdBy });
        res.redirect('/Event/Events');
    } catch (error) {
        console.error("Error creating event:", error);
        res.status(500).send("Error creating event.");
    }
});



// Route: List events
router.get('/Events', async (req, res) => {
    try {
        const userId = req.session.user;
        const createdEvents = await getCreatedEventsByUser(userId);
        const invitedEvents = await getInvitedEventsByUser(userId);
        res.render('Events', { createdEvents, invitedEvents });
    } catch (error) {
        console.error("Error loading events:", error);
        res.status(500).send("Error loading events.");
    }
});

// Route: Event details
router.get('/EventDetails/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const event = await getEventById(id);
        const comments = await getCommentsForEvent(id);
        res.render('EventDetails', { event, comments });
    } catch (error) {
        console.error("Error loading event details:", error);
        res.status(500).send("Error loading event details.");
    }
});

// Route: Edit event page
router.get('/EditEvent/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const event = await getEventById(id);
        res.render('EditEvent', { event });
    } catch (error) {
        console.error("Error loading event for editing:", error);
        res.status(500).send("Error loading event for editing.");
    }
});

// Route: Update an event (POST)
router.post('/UpdateEvent/:id', async (req, res) => {
    const { id } = req.params;
    const { eventName, description, eventType, eventDate, startTime, location, invitees, additionalInfo } = req.body;

    // Create an object to store the fields that should be updated
    const updatedEventData = {};

    // Only include fields that are defined or have valid values
    if (eventName) updatedEventData.eventName = eventName;
    if (description) updatedEventData.description = description;
    if (eventDate) updatedEventData.eventDate = eventDate;
    if (startTime) updatedEventData.startTime = startTime;
    if (location) updatedEventData.location = location;
    if (eventType !== undefined) updatedEventData.isPrivate = eventType === 'on'; // Private event logic
    if (invitees) updatedEventData.invitees = invitees.split(',').map(email => email.trim()); // Handle empty invitees list
    if (additionalInfo) updatedEventData.additionalInfo = additionalInfo;

    // If a new image or media is uploaded, update it
    if (req.file) {
        updatedEventData.imagePath = req.file.path;  // Update the event image path if a new image was uploaded
    }

    try {
        // Update the event with the sanitized data
        await updateEvent(id, updatedEventData);
        res.redirect(`/Event/EventDetails/${id}`);
    } catch (error) {
        console.error("Error updating event:", error);
        res.status(500).send("Error updating event.");
    }
});

// Route: Delete an event
router.post('/DeleteEvent/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await deleteEvent(id);
        res.redirect('/Event/Events');
    } catch (error) {
        console.error("Error deleting event:", error);
        res.status(500).send("Error deleting event.");
    }
});

// Route: Add a comment to an event
router.post('/AddComment/:id', async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
        return res.status(400).send("Comment cannot be empty.");
    }

    try {
        await addCommentToEvent(id, comment, req.session.user);
        res.redirect(`/Event/EventDetails/${id}`);
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).send("Error adding comment.");
    }
});

// Route: Upload media for an event
router.post('/AddMedia/:id', upload.array('media', 10), async (req, res) => {
    const eventId = req.params.id;
    const mediaFiles = req.files;

    if (!mediaFiles || mediaFiles.length === 0) {
        return res.status(400).send("At least one media file is required.");
    }

    try {
        const mediaUrls = await Promise.all(
            mediaFiles.map(async (file) => {  // `file` is now correctly scoped inside the map
                // Log for debugging
                console.log(`Uploading file: ${file.originalname}`);

                // Prepare FormData to send the file
                const formData = new FormData();
                formData.append('image', fs.createReadStream(file.path)); // `file` is defined here inside the map function

                // Post to ImgBB with FormData
                const imgBBResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
                    params: {
                        key: 'd70949846c779ce36b5ceef9d040b1ae',  // Ensure this key is valid
                    },
                    headers: formData.getHeaders(), // Automatically sets the proper Content-Type header
                });

                // Log response to debug
                console.log("imgBB Response:", imgBBResponse.data);

                if (imgBBResponse.data.error) {
                    throw new Error(`ImgBB Error: ${imgBBResponse.data.error.message}`);
                }

                return imgBBResponse.data.data.url;  // Return the image URL
            })
        );

        // Fetch and update the event
        const event = await getEventById(eventId);
        event.media = event.media ? event.media.concat(mediaUrls) : mediaUrls;  // Append new media URLs
        await updateEvent(eventId, { media: event.media });

        res.redirect(`/Event/EventDetails/${eventId}`);
    } catch (error) {
        console.error('Error uploading media:', error.response?.data || error.message);
        res.status(500).send('Error uploading media.');
    }
});





export default router;
