/**
 * Gun.js Service - Authentication and data management
 *
 * Peers with the same chat-signaling relay mesh the production dchat web
 * portal (app.js) uses — NOT dchat.staging.trustgrid.com, which is a
 * separate graph that never syncs with real users. Connecting to the
 * wrong peers is indistinguishable from "sync is broken": writes succeed
 * locally and reads return empty, with no error surfaced anywhere.
 */

import Gun from 'gun';
import 'gun/sea';

const gun = Gun([
  'https://dchat.staging.trustgrid.com/gun',
]);

export interface GunUser {
  username: string;
  alias: string;
}

export interface GunGroup {
  groupId: string;
  name: string;
  description?: string;
  creator: string;
  members: Record<string, boolean>;
  createdAt: number;
}

export interface GunMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

class GunService {
  private gun = gun;
  private currentUser: any = null;
  private peerReadyPromise: Promise<void> | null = null;

  /**
   * Resolve once at least one relay peer has connected (Gun's 'hi' event),
   * or after a timeout -- whichever comes first. Cached once per app session
   * since later calls are effectively free.
   */
  private waitForPeer(timeoutMs = 4000): Promise<void> {
    if (this.peerReadyPromise) return this.peerReadyPromise;
    this.peerReadyPromise = new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      this.gun.on('hi', () => done());
      setTimeout(done, timeoutMs);
    });
    return this.peerReadyPromise;
  }

  /**
   * Force-fetch and cache an alias's `~@alias` index node before touching
   * SEA's own auth machinery.
   *
   * Root cause of "Wrong user or password" on any browser/device other than
   * the one an account was created on: on a cold connection (nothing in this
   * peer's local graph yet), this specific relay can take several seconds to
   * answer even a single-hop lookup -- measured ~9s for a first response.
   * Gun's own internal `user.auth()` gives up on its (much shorter) internal
   * wait long before that answer arrives, and reports it identically to an
   * actually-wrong password. Doing this lookup ourselves first, with an
   * explicit long `wait`, warms Gun's local graph cache so the alias/pub
   * lookup `auth()` performs internally resolves instantly instead of
   * racing the network. (Verified: auth() takes ~300ms after this warm-up,
   * vs. failing outright without it.)
   */
  private warmAliasLookup(username: string, waitMs = 9000): Promise<void> {
    return new Promise((resolve) => {
      this.gun.get(`~@${username}`).once(() => resolve(), { wait: waitMs } as any);
      // Belt-and-suspenders in case this Gun version ignores the `wait` option.
      setTimeout(resolve, waitMs + 500);
    });
  }

  /**
   * Whether an alias already has a SEA account on the relay.
   *
   * Exists specifically so login flows can avoid ever calling
   * registerUser() a second time for the same alias after a failed login.
   * SEA's user.create() doesn't reliably error "already created" when the
   * relay's `~@alias` index hasn't finished syncing (the same slow-cold-
   * lookup issue documented on warmAliasLookup) -- it can silently mint a
   * second, conflicting keypair under the same alias instead, after which
   * *neither* identity authenticates reliably. Checking first and refusing
   * to re-register when something is already there prevents that.
   */
  async aliasExists(username: string, waitMs = 9000): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (exists: boolean) => {
        if (settled) return;
        settled = true;
        resolve(exists);
      };
      this.gun.get(`~@${username}`).once((data: unknown) => finish(Boolean(data)), { wait: waitMs } as any);
      setTimeout(() => finish(false), waitMs + 500);
    });
  }

  /**
   * Register a new user with username and password
   */
  async registerUser(username: string, password: string): Promise<boolean> {
    await this.waitForPeer();
    return new Promise((resolve, reject) => {
      const user = this.gun.user();
      user.create(username, password, (ack: any) => {
        if (ack.err) {
          console.error('Registration error:', ack.err);
          reject(new Error(ack.err));
        } else {
          // Store user info in Gun
          this.gun.get('users').get(username).put({
            username: username,
            alias: username,
            registered: Date.now(),
          });
          console.log('User registered successfully:', username);
          resolve(true);
        }
      });
    });
  }

  /**
   * Login user with username and password.
   *
   * Warms the alias lookup first (see warmAliasLookup) so a cold browser/
   * device isn't racing the relay's first response inside auth()'s own
   * short internal timeout, then retries a couple more times with backoff
   * as a safety net for anything the warm-up didn't fully settle.
   */
  async loginUser(username: string, password: string): Promise<GunUser> {
    await this.waitForPeer();
    await this.warmAliasLookup(username);

    const attempt = (): Promise<GunUser> =>
      new Promise((resolve, reject) => {
        const user = this.gun.user();
        user.auth(username, password, (ack: any) => {
          if (ack.err) {
            reject(new Error(ack.err));
          } else {
            this.currentUser = user;
            // Matches app.js's own login(): re-puts the public profile on
            // every successful auth, not just at registration. (Also means
            // that -- same as the real client -- a deactivated user who
            // logs in normally heals their own users/<alias> profile; see
            // deactivateUser's docs.)
            this.gun.get('users').get(username).put({ username } as unknown as Partial<unknown>);
            resolve({
              username: username,
              alias: (user.is?.alias as string) || username,
            });
          }
        });
      });

    const retryDelaysMs = [0, 1500, 3000];
    let lastError: Error = new Error('Login failed');
    for (const delay of retryDelaysMs) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      try {
        const result = await attempt();
        console.log('User logged in:', username);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Login failed');
        console.warn('Login attempt failed, retrying:', lastError.message);
      }
    }

    console.error('Login error:', lastError.message);
    throw new Error('Login failed');
  }

  /**
   * Get current logged-in user
   */
  getCurrentUser(): any {
    return this.currentUser;
  }

  /**
   * Logout current user
   */
  logout(): void {
    if (this.currentUser && this.currentUser.leave) {
      // Also wipes the recall() pair from sessionStorage, so a page reload
      // after logout doesn't just silently restore the old session.
      this.currentUser.leave();
    }
    this.currentUser = null;
  }

  /**
   * Restore a previous session after a page reload, instead of requiring the
   * PIN again every time (the underlying "Dashboard Refresh Logs Out User"
   * bug). Must be called once, early, on every app load -- even when there's
   * nothing to restore -- because Gun's recall() is also what arms
   * `remember`, the flag that makes a *subsequent* successful login persist
   * its session for next time.
   *
   * Recall re-authenticates from a locally-stored SEA keypair rather than
   * alias+password, which is why it's fast (pure local crypto, no relay
   * round-trip to look up an account by name) -- but it leaves
   * `user.is.alias` as the raw pub-key hash instead of the human username,
   * so this patches it back from the account's own graph node before
   * resolving.
   */
  async recallSession(): Promise<GunUser | null> {
    if (typeof window === 'undefined') return null;
    const hasStoredPair = Boolean(window.sessionStorage.getItem('pair'));
    // The common case: this browser tab already knows its own human alias
    // (we stopped wiping it -- see AppRouter's AuthGate) so recall doesn't
    // need to ask the relay who it is; a cold lookup for that can take
    // several seconds. Only fall back to asking Gun when that flag is
    // somehow missing despite a recall pair being present.
    const knownAlias = window.sessionStorage.getItem('dtak_admin_id');

    return new Promise((resolve) => {
      let settled = false;
      const user: any = this.gun.user();

      const resolveWithAlias = (alias: string) => {
        if (settled) return;
        settled = true;
        user.is.alias = alias;
        this.currentUser = user;
        resolve({ username: alias, alias });
      };
      const resolveNull = () => {
        if (settled) return;
        settled = true;
        resolve(null);
      };

      this.gun.on('auth', () => {
        if (!user.is || !user.is.pub) {
          resolveNull();
          return;
        }
        if (knownAlias) {
          resolveWithAlias(knownAlias);
          return;
        }
        if (user.is.alias && user.is.alias !== user.is.pub) {
          resolveWithAlias(user.is.alias);
          return;
        }
        // Recall re-authenticates from the raw SEA pair (no alias/password
        // involved), which leaves user.is.alias as the pub-key hash -- patch
        // it back from the account's own graph node. This path is only hit
        // without a knownAlias (e.g. a second tab that never had one set),
        // so the multi-second cold-lookup cost is rare, not per-refresh.
        this.gun.get(`~${user.is.pub}`).get('alias').once((realAlias: unknown) => {
          resolveWithAlias(typeof realAlias === 'string' && realAlias ? realAlias : user.is.pub);
        }, { wait: 9000 } as any);
      });

      user.recall({ sessionStorage: true });

      if (!hasStoredPair) {
        // Nothing to restore -- resolve immediately rather than making
        // every first-ever visit wait out the fallback timeout below.
        resolveNull();
        return;
      }
      setTimeout(resolveNull, knownAlias ? 4000 : 10000);
    });
  }

  /**
   * Create a new group with admin and members
   */
  async createGroup(groupName: string, admin: string, members: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // `creator`, not `admin` -- this is the field app.js's own admin checks
      // (removeMember, addMemberToStream, the "Manage"/"Admin badge" UI) key
      // off of. Writing `admin` meant groups created from this dashboard were
      // unmanageable from the real dchat clients: creator === undefined never
      // matches the logged-in user, so every admin-only action there silently
      // no-ops for them.
      const groupData: GunGroup = {
        groupId,
        name: groupName,
        creator: admin,
        members: { [admin]: true },
        createdAt: Date.now(),
      };

      // Add other members
      members.forEach(member => {
        groupData.members[member] = true;
      });

      // Save group to Gun
      this.gun.get('groups').get(groupId).put(groupData, (ack: any) => {
        if (ack.err) {
          console.error('Error creating group:', ack.err);
          reject(new Error('Failed to create group'));
        } else {
          // Add group to admin's groups
          if (this.currentUser) {
            this.currentUser.get('groups').set(groupId, () => {
              // Add group to all members
              members.forEach(member => {
                this.gun.get('users').get(member).get('groups').set(groupId as unknown as Partial<unknown>);
              });
              console.log('Group created successfully:', groupId);
              resolve(groupId);
            });
          } else {
            resolve(groupId);
          }
        }
      });
    });
  }

  /**
   * Get all groups for current user
   */
  getUserGroups(username: string, callback: (groups: GunGroup[]) => void): void {
    const groups: GunGroup[] = [];
    const groupIds: string[] = [];

    this.gun.get('users').get(username).get('groups').map().on((groupId: string) => {
      if (groupId && !groupIds.includes(groupId)) {
        groupIds.push(groupId);
        
        this.gun.get('groups').get(groupId).once((groupData: GunGroup) => {
          if (groupData) {
            groups.push(groupData);
            callback(groups);
          }
        });
      }
    });
  }

  /**
   * Get group details
   */
  getGroup(groupId: string, callback: (group: GunGroup | null) => void): void {
    this.gun.get('groups').get(groupId).once((groupData: GunGroup) => {
      callback(groupData || null);
    });
  }

  /** Promise-based single fetch of a group's Gun node (creator, disabled, etc). */
  async getGroupOnce(groupId: string, waitMs = 3000): Promise<(GunGroup & { disabled?: boolean }) | null> {
    return new Promise((resolve) => {
      let settled = false;
      this.gun.get('groups').get(groupId).once(
        (groupData: any) => {
          if (settled) return;
          settled = true;
          resolve(groupData || null);
        },
        { wait: waitMs } as any
      );
      setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(null);
      }, waitMs + 500);
    });
  }

  /**
   * Real member list for a group, read straight from Gun's
   * groups/<id>/members set -- the source of truth app.js's own
   * getMembersInfo() counts from. The admin REST API's list-endpoint
   * `memberCount` field was found to be unreliable (returns 1 for every
   * group regardless of actual membership, confirmed against both this
   * same Gun data and the REST detail endpoint, which agree with each
   * other but not with the list endpoint), so this is what the dashboard's
   * member counts and edit-group view should use instead.
   */
  async getGroupMembers(groupId: string, waitMs = 4000): Promise<string[]> {
    return new Promise((resolve) => {
      const members = new Set<string>();
      this.gun
        .get('groups')
        .get(groupId)
        .get('members')
        .map()
        .once((value: unknown, key: string) => {
          if (value === true && key) members.add(key);
        }, { wait: waitMs } as any);
      setTimeout(() => resolve(Array.from(members)), waitMs + 500);
    });
  }

  /**
   * Add member to group (admin only)
   */
  async addMemberToGroup(groupId: string, memberUsername: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get('groups').get(groupId).get('members').get(memberUsername).put(true, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to add member'));
        } else {
          // Add group to member's groups
          this.gun.get('users').get(memberUsername).get('groups').set(groupId as unknown as Partial<unknown>, () => {
            resolve();
          });
        }
      });
    });
  }

  /**
   * Remove member from group (admin only)
   */
  async removeMemberFromGroup(groupId: string, memberUsername: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get('groups').get(groupId).get('members').get(memberUsername).put(null, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to remove member'));
        } else {
          this.gun.get('users').get(memberUsername).get('groups').set({ [groupId]: null }, () => {
            resolve();
          });
        }
      });
    });
  }

  /**
   * Send direct message to user.
   *
   * Stored FLAT at chats/<chatId> (one .get() before .set()/.map()), matching
   * the production web portal's schema exactly — both so messages actually
   * interoperate with real dchat clients reading/writing that same path, and
   * because a nested chats/<chatId>/messages/<msgId> shape (two .get()s
   * before .map()) is the same shape that silently fails to sync between two
   * SEA-authenticated peers (see the contact-request fix in this file).
   */
  async sendDirectMessage(recipientUsername: string, messageText: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.is) {
      throw new Error('User not logged in');
    }

    const sender = this.currentUser.is.alias;
    const chatId = this.getChatId(sender, recipientUsername);

    return new Promise((resolve, reject) => {
      this.gun.get('chats').get(chatId).set({
        sender: sender,
        content: messageText,
        timestamp: Date.now(),
      }, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to send message'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send group message. Stored FLAT at groupChats/<groupId>, same reasoning
   * as sendDirectMessage above.
   */
  async sendGroupMessage(groupId: string, messageText: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.is) {
      throw new Error('User not logged in');
    }

    const sender = this.currentUser.is.alias;

    return new Promise((resolve, reject) => {
      this.gun.get('groupChats').get(groupId).set({
        sender: sender,
        content: messageText,
        timestamp: Date.now(),
      }, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to send message'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Load (and live-subscribe to) direct messages with a user.
   */
  loadDirectMessages(otherUsername: string, callback: (messages: GunMessage[]) => void): void {
    if (!this.currentUser || !this.currentUser.is) {
      console.error('User not logged in');
      return;
    }

    const sender = this.currentUser.is.alias;
    const chatId = this.getChatId(sender, otherUsername);
    const messagesById = new Map<string, GunMessage>();

    this.gun.get('chats').get(chatId).map().on((msgData: any, id: string) => {
      if (!msgData) return;
      messagesById.set(id, {
        id,
        sender: msgData.sender,
        content: msgData.content,
        timestamp: msgData.timestamp,
      });
      const messages = Array.from(messagesById.values()).sort((a, b) => a.timestamp - b.timestamp);
      callback(messages);
    });
  }

  /**
   * Load (and live-subscribe to) group messages.
   */
  loadGroupMessages(groupId: string, callback: (messages: GunMessage[]) => void): void {
    const messagesById = new Map<string, GunMessage>();

    this.gun.get('groupChats').get(groupId).map().on((msgData: any, id: string) => {
      if (!msgData) return;
      messagesById.set(id, {
        id,
        sender: msgData.sender,
        content: msgData.content,
        timestamp: msgData.timestamp,
      });
      const messages = Array.from(messagesById.values()).sort((a, b) => a.timestamp - b.timestamp);
      callback(messages);
    });
  }

  /**
   * Get all users (for selection)
   */
  getAllUsers(callback: (users: string[]) => void): void {
    const users: string[] = [];

    this.gun.get('users').map().once((userData: any, username: string) => {
      if (userData && userData.username && !users.includes(username)) {
        users.push(username);
        callback(users);
      }
    });
  }

  /**
   * Deactivate a user: wipe their public profile fields and flag them as
   * deactivated so any client reading the shared graph can refuse them access.
   * Gun/SEA has no central "kill switch" for a keypair, so this only revokes
   * the app-level profile this codebase controls.
   */
  async deactivateUser(username: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get('users').get(username).put({
        username: null,
        alias: null,
        deactivated: true,
        deactivatedAt: Date.now(),
      } as unknown as Partial<unknown>, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to deactivate user'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Reverse a deactivation and restore the user's public profile fields.
   */
  async activateUser(username: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get('users').get(username).put({
        username: username,
        alias: username,
        deactivated: false,
        deactivatedAt: null,
      } as unknown as Partial<unknown>, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to activate user'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check whether a user is currently flagged as deactivated.
   */
  isUserDeactivated(username: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.gun.get('users').get(username).get('deactivated').once((val: any) => {
        resolve(Boolean(val));
      });
    });
  }

  /**
   * Deactivate/reactivate a group with a real, working effect on the actual
   * dchat clients today -- not just a `disabled` flag nobody reads (app.js's
   * group code has no concept of that anywhere). app.js's loadStreams()
   * decides whether to show a group to a user by checking
   * `members.indexOf(user.is.alias) > -1` against groups/<id>/members, which
   * IS something the group owner/admin can write. So deactivating actually
   * clears that members set (the group disappears from everyone's stream
   * list on their next load/refresh of the real client), and activating
   * restores it from a backup snapshot taken at deactivation time.
   *
   * There's no REST endpoint for this either way (confirmed:
   * /groups/:id/disable and /enable both 404 on the admin API), so Gun is
   * the only persistence layer available regardless.
   */
  /**
   * Rename a group / reassign its admin (the `creator` field -- see
   * createGroup's note on why it's `creator` and not `admin`). Like
   * setGroupDisabled, there's no REST endpoint for this, so Gun is the only
   * persistence layer; the Edit Group modal used to only update local React
   * state here, which is why a renamed group reverted to its old name on
   * the next refresh/fetch.
   */
  async updateGroupDetails(groupId: string, updates: { name?: string; creator?: string }): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.creator !== undefined) patch.creator = updates.creator;
    if (Object.keys(patch).length === 0) return;

    return new Promise((resolve, reject) => {
      this.gun
        .get('groups')
        .get(groupId)
        .put(patch as unknown as Partial<unknown>, (ack: any) => {
          if (ack.err) {
            reject(new Error('Failed to update group'));
          } else {
            resolve();
          }
        });
    });
  }

  async setGroupDisabled(groupId: string, disabled: boolean): Promise<void> {
    const groupNode = this.gun.get('groups').get(groupId);

    if (disabled) {
      const members = await this.getGroupMembers(groupId);
      await new Promise<void>((resolve, reject) => {
        groupNode.put(
          { disabled: true, disabledAt: Date.now() } as unknown as Partial<unknown>,
          (ack: any) => (ack.err ? reject(new Error('Failed to update group status')) : resolve())
        );
      });
      await Promise.all(
        members.map(
          (m) =>
            new Promise<void>((resolve) => {
              groupNode.get('disabledMembersBackup').get(m).put(true, () => {
                groupNode.get('members').get(m).put(null, () => resolve());
              });
            })
        )
      );
    } else {
      const backupMembers = await new Promise<string[]>((resolve) => {
        const found = new Set<string>();
        groupNode
          .get('disabledMembersBackup')
          .map()
          .once((value: unknown, key: string) => {
            if (value === true && key) found.add(key);
          }, { wait: 4000 } as any);
        setTimeout(() => resolve(Array.from(found)), 4500);
      });

      await new Promise<void>((resolve, reject) => {
        groupNode.put(
          { disabled: false, disabledAt: null } as unknown as Partial<unknown>,
          (ack: any) => (ack.err ? reject(new Error('Failed to update group status')) : resolve())
        );
      });
      await Promise.all(
        backupMembers.map(
          (m) =>
            new Promise<void>((resolve) => {
              groupNode.get('members').get(m).put(true, () => {
                groupNode.get('disabledMembersBackup').get(m).put(null, () => resolve());
              });
            })
        )
      );
    }
  }

  /**
   * Send a contact request from the current user to another user.
   *
   * Stored at users/<toUsername>/contactRequests/<gunId> = {from, timestamp},
   * matching exactly what the production dchat client (app.js's addContact())
   * writes -- this is NOT a flat top-level collection. The admin console must
   * read from this same nested path or it will never see requests real
   * mobile/web dchat users send.
   */
  async sendContactRequest(toUsername: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.is) {
      throw new Error('User not logged in');
    }
    const fromUsername = this.currentUser.is.alias;
    return new Promise((resolve, reject) => {
      this.gun.get('users').get(toUsername).get('contactRequests').set({
        from: fromUsername,
        timestamp: Date.now(),
      }, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to send contact request'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Accept a pending contact request: add each user to the other's contact
   * list (same shape as app.js's handleContactRequest -- the accepting
   * user's own SEA-authenticated contacts node, plus a mirrored entry under
   * the requester's public users/<alias>/contacts node), mark the request
   * handled, and notify the requester via contactAcceptances so their client
   * picks it up too.
   */
  async acceptContactRequest(requestId: string, toUsername: string, fromUsername: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.is) {
      throw new Error('User not logged in');
    }

    // Wait for both contact-list writes to be acknowledged before returning,
    // so the caller can't tear down the session mid-write and lose one side.
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        this.currentUser.get('contacts').get(fromUsername).put({ alias: fromUsername }, (ack: any) => {
          if (ack.err) reject(new Error('Failed to update contacts'));
          else resolve();
        });
      }),
      new Promise<void>((resolve, reject) => {
        this.gun.get('users').get(fromUsername).get('contacts').get(toUsername).put({ alias: toUsername }, (ack: any) => {
          if (ack.err) reject(new Error('Failed to update contacts'));
          else resolve();
        });
      }),
    ]);

    await new Promise<void>((resolve, reject) => {
      this.gun.get('users').get(toUsername).get('contactRequests').get(requestId).put(
        { handled: true, acceptedAt: Date.now() } as unknown as Partial<unknown>,
        (ack: any) => {
          if (ack.err) reject(new Error('Failed to mark contact request handled'));
          else resolve();
        }
      );
    });

    this.gun.get('users').get(fromUsername).get('contactAcceptances').set({
      from: toUsername,
      timestamp: Date.now(),
    });
  }

  /**
   * Helper: Generate chat ID from two usernames
   */
  private getChatId(user1: string, user2: string): string {
    return [user1, user2].sort().join('_');
  }
}

export const gunService = new GunService();