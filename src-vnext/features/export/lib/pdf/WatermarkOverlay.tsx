import { Text, View, StyleSheet } from "@react-pdf/renderer"

interface WatermarkOverlayProps {
  readonly watermark: {
    readonly text: string
    readonly opacity: number
    readonly fontSize: number
    readonly color: string
  }
}

const wmStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
})

export function WatermarkOverlay({ watermark }: WatermarkOverlayProps) {
  return (
    <View fixed style={wmStyles.container}>
      <Text
        style={{
          fontSize: watermark.fontSize,
          color: watermark.color,
          opacity: watermark.opacity / 100,
          transform: "rotate(-45deg)",
          textAlign: "center",
        }}
      >
        {watermark.text}
      </Text>
    </View>
  )
}
