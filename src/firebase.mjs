import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "firebase/auth";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    getDoc, 
    query, 
    where, 
    deleteDoc, 
    updateDoc 
} from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import fs from "fs";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyArePdmV5-oz4XDNxUrh3Qq5f3_QamWZR4",
    authDomain: "huppsiv2.firebaseapp.com",
    projectId: "huppsiv2",
    storageBucket: "huppsiv2.appspot.com",
    messagingSenderId: "418286355722",
    appId: "1:418286355722:web:123456"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Authentication Functions
export async function loginUser(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
}

export async function registerUser(email, password) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
}

// Firestore Functions
export async function createEvent(event) {
    const docRef = await addDoc(collection(db, "events"), event);
    return { id: docRef.id, ...event };
}

export async function getAllEvents() {
    const querySnapshot = await getDocs(collection(db, "events"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getEventById(id) {
    const docRef = doc(db, "events", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Event not found");
    return { id: docSnap.id, ...docSnap.data() };
}

export async function getCreatedEventsByUser(userId) {
    const eventsRef = collection(db, "events");
    const q = query(eventsRef, where("createdBy", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getInvitedEventsByUser(userId) {
    const invitationsRef = collection(db, "event_invitations");
    const q = query(invitationsRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const eventIds = querySnapshot.docs.map(doc => doc.data().eventId);

    const events = await Promise.all(
        eventIds.map(async id => {
            const eventDoc = await getDoc(doc(db, "events", id));
            return { id: eventDoc.id, ...eventDoc.data() };
        })
    );
    return events;
}

export async function addCommentToEvent(eventId, comment, userId) {
    const commentData = { eventId, comment, userId, createdAt: new Date() };
    const docRef = await addDoc(collection(db, "event_comments"), commentData);
    return { id: docRef.id, ...commentData };
}

export async function getCommentsForEvent(eventId) {
    const commentsRef = collection(db, "event_comments");
    const q = query(commentsRef, where("eventId", "==", eventId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteEvent(eventId) {
    const eventDocRef = doc(db, "events", eventId);
    await deleteDoc(eventDocRef);
    return { success: true };
}

export async function updateEvent(eventId, updatedEventData) {
    const eventDocRef = doc(db, "events", eventId);
    await updateDoc(eventDocRef, updatedEventData);
    return { id: eventId, ...updatedEventData };
}

export async function uploadMediaForEvent(file) {
    const imgBBResponse = await axios.post('https://api.imgbb.com/1/upload', {
        key: 'd70949846c779ce36b5ceef9d040b1ae',  // Use the new valid key
        image: base64Image,
    });
    const fileRef = ref(storage, `media/${file.filename}`);
    const fileBuffer = fs.readFileSync(file.path);
    await uploadBytes(fileRef, fileBuffer);
    return `media/${file.filename}`;
}
