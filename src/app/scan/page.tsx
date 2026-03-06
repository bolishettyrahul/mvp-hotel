import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ScanPage() {
    let table;
    try {
        // For demo purposes, "scanning" just finds the first active table and redirects to it
        table = await prisma.table.findFirst({
            where: { isActive: true },
            orderBy: { number: 'asc' }
        });
    } catch (err) {
        console.error('Database error in /scan:', err);
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50 text-center text-stone-900">
                <div>
                    <span className="text-4xl block mb-4">🔌</span>
                    <h1 className="text-2xl font-bold mb-2">Service Unavailable</h1>
                    <p className="text-stone-500">Unable to connect to the database. Please try again later.</p>
                </div>
            </div>
        );
    }

    if (!table) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50 text-center text-stone-900">
                <div>
                    <span className="text-4xl block mb-4">⚠️</span>
                    <h1 className="text-2xl font-bold mb-2">No Tables Found</h1>
                    <p className="text-stone-500">Please contact the administrator to set up tables.</p>
                </div>
            </div>
        );
    }

    // Redirect to the table's menu
    redirect(`/table/${table.id}/menu`);
}
