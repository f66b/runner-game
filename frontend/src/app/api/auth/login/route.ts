import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username } = body;

        if (!username) {
            return NextResponse.json({ error: 'Username required' }, { status: 400 });
        }

        let user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    username,
                    balance: 1000000000, // 1000 USDC start
                }
            });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return NextResponse.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                runCount: user.runCount
            }
        });
    } catch (e) {
        console.error('Login error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
