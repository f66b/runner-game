import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface AuthUser {
    id: string;
    username: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;

    const token = authHeader.split(' ')[1];
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        // Verify user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });

        if (!user) return null;

        return {
            id: user.id,
            username: user.username
        };
    } catch (e) {
        return null;
    }
}

export function unauthorized() {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
