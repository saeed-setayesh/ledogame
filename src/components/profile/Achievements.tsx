"use client";

import { useState, useEffect } from "react";
import { Award, Star, Medal, Crown, Dices, ArrowUp, Lock } from "lucide-react";

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
  icon: string;
  unlockedAt?: string;
}

export default function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const response = await fetch("/api/profile/achievements");
      const data = await response.json();
      setAchievements(data.achievements || []);
    } catch (error) {
      console.error("Failed to fetch achievements:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName: string, unlocked: boolean) => {
    const iconClass = unlocked ? "text-accent" : "text-foreground/30";
    const size = "w-6 h-6";

    switch (iconName) {
      case "trophy":
        return <Award className={`${size} ${iconClass}`} />;
      case "star":
        return <Star className={`${size} ${iconClass}`} />;
      case "medal":
        return <Medal className={`${size} ${iconClass}`} />;
      case "crown":
        return <Crown className={`${size} ${iconClass}`} />;
      case "dice":
        return <Dices className={`${size} ${iconClass}`} />;
      case "arrow-up":
        return <ArrowUp className={`${size} ${iconClass}`} />;
      default:
        return <Award className={`${size} ${iconClass}`} />;
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Achievements</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`p-4 rounded-lg border ${
              achievement.unlocked
                ? "bg-accent/10 border-accent/30"
                : "bg-background border-border opacity-60"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {achievement.unlocked ? (
                  getIcon(achievement.icon, true)
                ) : (
                  <div className="relative">
                    {getIcon(achievement.icon, false)}
                    <Lock className="w-3 h-3 absolute -top-1 -right-1 text-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold mb-1">{achievement.name}</h4>
                <p className="text-sm text-foreground/70 mb-2">
                  {achievement.description}
                </p>
                {!achievement.unlocked &&
                  achievement.progress !== undefined && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-foreground/50">
                        <span>Progress</span>
                        <span>
                          {achievement.progress} / {achievement.target}
                        </span>
                      </div>
                      <div className="w-full bg-background rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{
                            width: `${
                              (achievement.progress / achievement.target!) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
