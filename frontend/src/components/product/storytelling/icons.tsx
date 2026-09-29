import React from "react";
import {
  Shield,
  Sparkles,
  Layers,
  Activity,
  Calendar,
  Ruler,
  Award,
  Check,
  Leaf,
  Wind,
  Bed,
  Heart,
  Smile,
  Zap,
  Box,
  Compass,
} from "lucide-react";

interface StoryIconProps {
  name?: string;
  className?: string;
}

export function StoryIcon({ name, className = "w-5 h-5 text-brand-leaf" }: StoryIconProps) {
  const n = (name || "").toLowerCase().trim();

  switch (n) {
    case "contour":
    case "ergonomic":
    case "activity":
      return <Activity className={className} />;
    case "latex":
    case "organic":
    case "leaf":
    case "plant":
      return <Leaf className={className} />;
    case "bamboo":
    case "wind":
    case "breathable":
    case "airflow":
      return <Wind className={className} />;
    case "shield":
    case "cover":
    case "safety":
      return <Shield className={className} />;
    case "layers":
    case "construction":
      return <Layers className={className} />;
    case "sparkles":
    case "comfort":
    case "pure":
      return <Sparkles className={className} />;
    case "calendar":
    case "age":
      return <Calendar className={className} />;
    case "ruler":
    case "dimensions":
    case "size":
      return <Ruler className={className} />;
    case "bed":
    case "sleep":
    case "mattress":
      return <Bed className={className} />;
    case "heart":
    case "kids":
    case "baby":
      return <Heart className={className} />;
    case "award":
    case "certified":
      return <Award className={className} />;
    case "check":
      return <Check className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}
