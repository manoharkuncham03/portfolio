import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseHealth, databaseManager } from '@/lib/database-manager';

export async function GET(request: NextRequest) {
  try {
    // Perform comprehensive health check
    const dbHealth = await checkDatabaseHealth();
    const connectionStats = databaseManager.getConnectionStats();
    
    const healthData = {
      status: dbHealth.status,
      timestamp: new Date().toISOString(),
      database: dbHealth.details,
      connections: connectionStats,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      environment: process.env.NODE_ENV,
    };

    const statusCode = dbHealth.status === 'healthy' ? 200 : 
                      dbHealth.status === 'degraded' ? 206 : 503;

    return NextResponse.json(healthData, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: String(error)
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}