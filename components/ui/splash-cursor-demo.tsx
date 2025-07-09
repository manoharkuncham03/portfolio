import { SplashCursor } from "@/components/ui/splash-cursor"

export function SplashCursorDemo() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Splash Cursor Effect */}
      <SplashCursor 
        SPLAT_RADIUS={0.25}
        SPLAT_FORCE={6000}
        COLOR_UPDATE_SPEED={10}
        DENSITY_DISSIPATION={1.2}
        VELOCITY_DISSIPATION={0.2}
        CURL={30}
        PRESSURE={0.8}
      />
      
      {/* Demo Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 text-white">
        <div className="text-center space-y-6 max-w-2xl">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Interactive Fluid Simulation
          </h1>
          
          <p className="text-xl text-gray-300 leading-relaxed">
            Move your mouse or touch the screen to create beautiful fluid effects. 
            The WebGL-powered simulation responds to your interactions in real-time.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h3 className="text-lg font-semibold mb-2 text-blue-300">Real-time Physics</h3>
              <p className="text-gray-400 text-sm">
                Advanced fluid dynamics simulation running at 60fps with WebGL shaders
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h3 className="text-lg font-semibold mb-2 text-purple-300">Interactive</h3>
              <p className="text-gray-400 text-sm">
                Mouse and touch interactions create dynamic splashes and color effects
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h3 className="text-lg font-semibold mb-2 text-pink-300">Customizable</h3>
              <p className="text-gray-400 text-sm">
                Adjustable parameters for viscosity, pressure, curl, and visual effects
              </p>
            </div>
          </div>
          
          <div className="mt-8 text-sm text-gray-500">
            Try moving your cursor around or tapping on mobile devices!
          </div>
        </div>
      </div>
    </div>
  )
}