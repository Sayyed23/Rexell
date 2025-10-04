"use server";


import {createCanvas, loadImage} from 'canvas';

export async function generateImage(eventName: string, venue: string, date: string, time: string, number: number): Promise<string> {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
  
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  
    // Text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 30pt Arial';
    ctx.fillText(eventName, 50, 100);
    ctx.font = '20pt Arial';
    ctx.fillText(`Venue: ${venue}`, 50, 150);
    ctx.fillText(`Date: ${date}`, 50, 200);
    ctx.fillText(`Time: ${time}`, 50, 250);
    ctx.fillText(`Ticket Number: ${number}`, 50, 300);
  
    return canvas.toDataURL();
  }
  