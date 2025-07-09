import { LiquidButton, MetalButton } from "@/components/ui/liquid-glass-button";

export default function LiquidGlassButtonDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
      <div className="space-y-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-8">
          Liquid Glass & Metal Buttons
        </h1>
        
        {/* Liquid Glass Buttons */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Liquid Glass Buttons</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <LiquidButton size="sm">Small</LiquidButton>
            <LiquidButton>Default</LiquidButton>
            <LiquidButton size="lg">Large</LiquidButton>
            <LiquidButton size="xl">Extra Large</LiquidButton>
            <LiquidButton size="xxl">XXL</LiquidButton>
          </div>
        </div>

        {/* Metal Buttons */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Metal Buttons</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <MetalButton variant="default">Default</MetalButton>
            <MetalButton variant="primary">Primary</MetalButton>
            <MetalButton variant="success">Success</MetalButton>
            <MetalButton variant="error">Error</MetalButton>
            <MetalButton variant="gold">Gold</MetalButton>
            <MetalButton variant="bronze">Bronze</MetalButton>
          </div>
        </div>
      </div>
    </div>
  )
}