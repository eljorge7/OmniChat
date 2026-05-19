const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();
const prefix = 'enc:v1:';
const algorithm = 'aes-256-gcm';

function getSecretKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) return '';
    if (key.length !== 32) return crypto.createHash('sha256').update(String(key)).digest('base64').substring(0, 32);
    return key;
}

function encrypt(text) {
    if (!text) return text;
    if (text.startsWith(prefix)) return text;
    const key = getSecretKey();
    if (!key) return text;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'utf8'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${prefix}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

async function run() {
    console.log('Migrando configuración de IA y WispHub (Companies) en OmniChat...');
    const companies = await prisma.company.findMany();
    let compCount = 0;
    for (const c of companies) {
        let updated = false;
        const data = {};
        if (c.openAiKey && !c.openAiKey.startsWith(prefix)) { data.openAiKey = encrypt(c.openAiKey); updated = true; }
        if (c.wisphubApiKey && !c.wisphubApiKey.startsWith(prefix)) { data.wisphubApiKey = encrypt(c.wisphubApiKey); updated = true; }
        
        if (updated) {
            await prisma.company.update({ where: { id: c.id }, data });
            compCount++;
        }
    }
    console.log(`Migradas ${compCount} compañías en OmniChat.`);

    console.log('Migrando Google Tokens (Users) en OmniChat...');
    const users = await prisma.user.findMany();
    let userCount = 0;
    for (const u of users) {
        let updated = false;
        const data = {};
        if (u.googleAccessToken && !u.googleAccessToken.startsWith(prefix)) { data.googleAccessToken = encrypt(u.googleAccessToken); updated = true; }
        if (u.googleRefreshToken && !u.googleRefreshToken.startsWith(prefix)) { data.googleRefreshToken = encrypt(u.googleRefreshToken); updated = true; }
        
        if (updated) {
            await prisma.user.update({ where: { id: u.id }, data });
            userCount++;
        }
    }
    console.log(`Migrados ${userCount} usuarios con Google Tokens en OmniChat.`);
}

run().finally(() => prisma.$disconnect());
