import React from "react";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import { useEffect, useRef } from "react";

interface Details {
  eventName: string;
  date: string;
  time: string;
  category: string;
  location: string;
  organiser: string;
  price: string;
  walletAddress: string;
  timestamp: number;
  ticketNo: number;
}

export const generateTicketImage = async (ticketDetails: Details) => {
  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    return '';
  }

  const ticketRef = document.createElement("div");

  const {
    eventName,
    date,
    time,
    category,
    location,
    organiser,
    price,
    walletAddress,
    timestamp,
    ticketNo,
  } = ticketDetails;

  const formattedTime = new Date(timestamp).toLocaleString();
  // Prepare the QR code data as a string
  const qrCodeData = JSON.stringify({
    Event: eventName,
    From: organiser,
    To: walletAddress,
    Time: formattedTime,
    Amount: price,
    TicketNo: ticketNo,
  });

  // Generate QR code as a base64 string with the custom data
  const qrCodeUrl = await QRCode.toDataURL(qrCodeData);

  // Create the ticket structure
  ticketRef.style.width = "100%";
  ticketRef.style.maxWidth = "600px"; // Adjust as needed
  ticketRef.style.position = "relative";

  // Create inner HTML structure without QR Code
  // Adjusted ticket HTML with further increased QR code size
  const ticketHTML = `
    <div class="flex w-full max-w-3xl shadow-lg">
      <div class="relative flex-1 rounded-md bg-cover bg-center p-6 text-white shadow-lg" style="background-image: url('/static/images/ticket/ticket.png')">
        <p class="text-sm uppercase text-nude">${category}</p>
        <h1 class="text-4xl font-bold text-purple-500">${eventName}</h1>
        <p class="mt-4 text-3xl font-bold text-gray-300">${date}</p>
        <div class="mt-6 flex justify-between">
          <div class="rounded-lg bg-gray-800 bg-opacity-50 p-4">
            <p class="text-sm font-semibold">Location</p>
            <p class="text-lg">${location}</p>
          </div>
          <div class="rounded-lg bg-gray-800 bg-opacity-50 p-4">
            <p class="text-sm font-semibold">At</p>
            <p class="text-lg">${time}</p>
          </div>
        </div>
        <div class="mt-6 rounded-lg bg-gray-900 bg-opacity-50 p-4">
          <p class="text-sm uppercase">Price</p>
          <p class="text-2xl font-bold text-nude">${price}</p>
        </div>
      </div>
      <div class="relative flex min-h-full flex-col items-center justify-center bg-nude p-6">
        <img src="${qrCodeUrl}" alt="QR Code" class="mb-4 h-36 w-36 rounded-lg" />
        <p class="text-xs text-black">Ticket No: ${ticketNo}</p>
      </div>
    </div>
  `;

  ticketRef.innerHTML = ticketHTML;

  // Append the ticket structure to the body (or any specific container)
  document.body.appendChild(ticketRef);

  // Generate the image
  const imageUrl = await toPng(ticketRef, { cacheBust: true });

  // Cleanup: Remove the ticket element from the DOM
  document.body.removeChild(ticketRef);

  return imageUrl;
};