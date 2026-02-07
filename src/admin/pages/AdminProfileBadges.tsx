import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type Badge = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

type ProfileData = {
  name: string;
  bio: string;
  avatarUrl: string;
  skills: string[];
  socialLinks: {
    github: string;
    linkedin: string;
    twitter: string;
    website: string;
  };
};

const defaultProfile: ProfileData = {
  name: "Guest User",
  bio: "",
  avatarUrl: "",
  skills: [],
  socialLinks: { github: "", linkedin: "", twitter: "", website: "" },
};

export default function AdminProfileBadges() {
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    apiFetch<{ user: any }>("/users/me")
      .then((d) => {
        const u = d?.user;
        if (!u) return;
        setProfile({
          name: String(u.name || ""),
          bio: String(u.bio || ""),
          avatarUrl: String(u.avatarUrl || ""),
          skills: Array.isArray(u.skills) ? u.skills : [],
          socialLinks: {
            github: String(u.socialLinks?.github || ""),
            linkedin: String(u.socialLinks?.linkedin || ""),
            twitter: String(u.socialLinks?.twitter || ""),
            website: String(u.socialLinks?.website || ""),
          },
        });
        setBadges(Array.isArray(u.badges) ? u.badges : []);
      })
      .catch(() => {
        setProfile(defaultProfile);
        setBadges([]);
      });
  }, []);

  const skillsText = useMemo(() => profile.skills.join(", "), [profile.skills]);

  const handleSaveProfile = async () => {
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          skills: profile.skills,
          socialLinks: profile.socialLinks,
        }),
      });
      toast.success("Profile updated");
      window.dispatchEvent(new Event("profile-updated"));
    } catch {
      toast.error("Failed to update profile");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-display font-bold">Profile & Badges</h1>
        <p className="text-muted-foreground mt-1">Manage profile fields stored in the database. Badges are computed automatically.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display font-bold">Profile</div>
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
              <div className="text-sm font-medium mb-1">Avatar URL</div>
              <Input value={profile.avatarUrl} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} />
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
              <div className="text-xs text-muted-foreground">Computed from activity</div>
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
                </div>
              </div>
            ))}

            {badges.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No badges found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
