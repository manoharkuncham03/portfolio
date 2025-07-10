import { NextRequest, NextResponse } from 'next/server';
import { databaseManager } from '@/lib/database-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    // Get conversation analytics
    const analyticsQuery = `
      SELECT 
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(*) as total_messages,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as messages_24h,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as messages_1h
      FROM conversation_context 
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;

    const result = await databaseManager.executeQuery(analyticsQuery, [], {
      cache: true,
      cacheTtl: 300000 // 5 minutes cache
    });

    if (!result || !result.rows || result.rows.length === 0) {
      return NextResponse.json({
        error: 'No analytics data available'
      }, { status: 404 });
    }

    const analytics = result.rows[0];

    // Get popular content
    const popularContentQuery = `
      SELECT 
        pc.title,
        pc.content_type,
        COUNT(ca.id) as access_count
      FROM portfolio_content pc
      LEFT JOIN content_analytics ca ON pc.id = ca.content_id
      WHERE ca.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY pc.id, pc.title, pc.content_type
      ORDER BY access_count DESC
      LIMIT 10
    `;

    const popularResult = await databaseManager.executeQuery(popularContentQuery, [], {
      cache: true,
      cacheTtl: 600000 // 10 minutes cache
    });

    const analyticsData = {
      period: `${days} days`,
      timestamp: new Date().toISOString(),
      overview: {
        totalSessions: parseInt(analytics.total_sessions) || 0,
        totalMessages: parseInt(analytics.total_messages) || 0,
        avgResponseTime: Math.round(parseFloat(analytics.avg_response_time) || 0),
        messages24h: parseInt(analytics.messages_24h) || 0,
        messages1h: parseInt(analytics.messages_1h) || 0,
      },
      popularContent: popularResult?.rows || [],
      connectionStats: databaseManager.getConnectionStats(),
    };

    return NextResponse.json(analyticsData, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch analytics',
      message: String(error)
    }, { status: 500 });
  }
}