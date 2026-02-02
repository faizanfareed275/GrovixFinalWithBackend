import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readJson, writeJson } from "@/admin/lib/storage";
import { toast } from "sonner";

type Badge = {
  id: string;
  name: string;
  icon: string;
  earnedAt: string;
  description: string;
};

type ProfileData = {
  name: string;
  bio: string;
  avatar: string;
  skills: string[];
  socialLinks: {
    github: string;
    linkedin: string;
    twitter: string;
    website: string;
  };
};

const PROFILE_KEY = "youthxp_profile";
const BADGES_KEY = "youthxp_earned_badges";

const defaultProfile: ProfileData = {
  name: "Guest User",
  bio: "",
  avatar: "GU",
  skills: [],
  socialLinks: { github: "", linkedin: "", twitter: "", website: "" },
};

export default function AdminProfileBadges() {
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const [badges, setBadges] = useState<Badge[]>([]);

  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  const [badgeForm, setBadgeForm] = useState({ id: "", name: "", icon: "⭐", description: "" });

  useEffect(() => {
    setProfile(readJson<ProfileData>(PROFILE_KEY, defaultProfile));
    setBadges(readJson<Badge[]>(BADGES_KEY, []));
  }, []);

  const persistProfile = (next: ProfileData) => {
    setProfile(next);
    writeJson(PROFILE_KEY, next);
  };

  const persistBadges = (next: Badge[]) => {
    setBadges(next);
    writeJson(BADGES_KEY, next);
  };

  const skillsText = useMemo(() => profile.skills.join(", "), [profile.skills]);

  const handleSaveProfile = () => {
    persistProfile(profile);
    toast.success("Profile updated");
  };

  const handleAddBadge = () => {
    const id = badgeForm.id.trim() || `badge_${Date.now()}`;
    if (!badgeForm.name.trim()) return;

    if (badges.some(b => b.id === id)) return;

    const next: Badge = {
      id,
      name: badgeForm.name.trim(),
      icon: badgeForm.icon || "⭐",
      description: badgeForm.description.trim(),
      earnedAt: new Date().toISOString(),
    };

    persistBadges([next, ...badges]);
    setBadgeDialogOpen(false);
    setBadgeForm({ id: "", name: "", icon: "⭐", description: "" });
    toast.success("Badge added");
  };

  const handleDeleteBadge = (id: string) => {
    persistBadges(badges.filter(b => b.id !== id));
    toast.success("Badge removed");
  };

  const handleClearBadges = () => {
    persistBadges([]);
    toast.success("Badges cleared");
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-display font-bold">Profile & Badges</h1>
        <p className="text-muted-foreground mt-1">Manage profile fields and earned badges stored in localStorage.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display font-bold">Profile</div>
              <div className="text-xs text-muted-foreground">{PROFILE_KEY}</div>
            </div>
            <Button variant="neon" onClick={handleSaveProfile}>
              <Save className="w-4 h-4" />
              Save
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">Name</div>
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Avatar (initials)</div>
              <Input value={profile.avatar} onChange={(e) => setProfile({ ...profile, avatar: e.target.value })} />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Bio</div>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="w-full h-28 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none"
            />
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Skills (comma separated)</div>
            <Input
              value={skillsText}
              onChange={(e) => {
                const nextSkills = e.target.value
                  .split(",")
                  .map(s => s.trim())
                  .filter(Boolean);
                setProfile({ ...profile, skills: nextSkills });
              }}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">GitHub</div>
              <Input value={profile.socialLinks.github} onChange={(e) => setProfile({ ...profile, socialLinks: { ...profile.socialLinks, github: e.target.value } })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">LinkedIn</div>
              <Input value={profile.socialLinks.linkedin} onChange={(e) => setProfile({ ...profile, socialLinks: { ...profile.socialLinks, linkedin: e.target.value } })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Twitter</div>
              <Input value={profile.socialLinks.twitter} onChange={(e) => setProfile({ ...profile, socialLinks: { ...profile.socialLinks, twitter: e.target.value } })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Website</div>
              <Input value={profile.socialLinks.website} onChange={(e) => setProfile({ ...profile, socialLinks: { ...profile.socialLinks, website: e.target.value } })} />
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <div className="font-display font-bold">Badges</div>
              <div className="text-xs text-muted-foreground">{BADGES_KEY}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBadgeDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                Add
              </Button>
              <Button variant="destructive" onClick={handleClearBadges}>
                Clear
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {badges.map(b => (
              <div key={b.id} className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{b.icon}</span>
                    <div className="font-medium truncate">{b.name}</div>
                    <span className="text-xs text-muted-foreground">({b.id})</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 break-words">{b.description}</div>
                  <div className="text-xs text-muted-foreground mt-2">Earned: {b.earnedAt}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteBadge(b.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            {badges.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No badges found.</div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={badgeDialogOpen} onOpenChange={setBadgeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Badge</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium mb-1">ID (optional)</div>
              <Input value={badgeForm.id} onChange={(e) => setBadgeForm({ ...badgeForm, id: e.target.value })} placeholder="e.g. first_challenge" />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Name</div>
              <Input value={badgeForm.name} onChange={(e) => setBadgeForm({ ...badgeForm, name: e.target.value })} placeholder="Badge name" />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Icon (emoji)</div>
              <Input value={badgeForm.icon} onChange={(e) => setBadgeForm({ ...badgeForm, icon: e.target.value })} placeholder="⭐" />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Description</div>
              <textarea
                value={badgeForm.description}
                onChange={(e) => setBadgeForm({ ...badgeForm, description: e.target.value })}
                className="w-full h-24 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setBadgeDialogOpen(false)}>Cancel</Button>
            <Button variant="neon" onClick={handleAddBadge}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
