import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { DID } from "@elastosfoundation/elastos-connectivity-sdk-js";
import jwtDecode from 'jwt-decode';
import { User } from '../model/user';

const AUTH_TOKEN_STORAGE_KEY = "didauthtoken";

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private user: User = null;
  private postAuthRoute: string = null;

  constructor(private jwtHelper: JwtHelperService, public router: Router) {
    this.loadUser();
  }

  /**
   * Reloads authenticated user info from the stored JWT.
   */
  private loadUser() {
    const token = this.getAuthToken();
    if (token) {
      try {
        this.user = jwtDecode(token);
        console.log("Loaded user from auth token:", this.user);
      }
      catch (e) {
        console.error("Failed to decode existing auth token, is this an invalid format?", token);
        // Cleanup this unclear state.
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        this.user = null;
      }
    }
  }

  public isAuthenticated(): boolean {
    const token = this.getAuthToken();
    return !!token && !this.jwtHelper.isTokenExpired(token);
  }

  public getAuthToken(): string {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  }

  public getAuthUser(): User {
    return this.user;
  }

  public signedInDID(): string {
    if (!this.user)
      return null;

    return this.user.did;
  }

  /**
   * Saves the route to which user should be redirected after a successful authentication.
   */
  public setPostAuthRoute(postAuthRoute: string) {
    console.log(`Setting post auth route to ${postAuthRoute}`);
    this.postAuthRoute = postAuthRoute;
  }

  public async signIn(): Promise<void> {
    const didAccess = new DID.DIDAccess();
    let presentation;

    console.log("Trying to sign in using the connectivity SDK");
    try {
      presentation = await didAccess.getCredentials({
        claims: {
          email: false // optional email to automatically fill passbase form for convenience
        }
      });
    } catch (e) {
      // Possible exception while using wallet connect (i.e. not an identity wallet)
      // Kill the wallet connect session
      console.warn("Error while getting credentials", e);
      return;
    }

    console.log("url", `${process.env.NG_APP_API_URL}/api/v1/login`)

    if (presentation) {
      const did = presentation.getHolder().getMethodSpecificId();

      try {
        let response = await fetch(`${process.env.NG_APP_API_URL}/api/v1/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(presentation.toJSON())
        });

        if (response.ok) {
          const token = await response.json();

          localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);

          this.user = jwtDecode(token);
          console.log("Sign in: setting user to:", this.user);

          if (this.postAuthRoute) {
            this.router.navigate([this.postAuthRoute]);
            this.postAuthRoute = null;
          }
          else {
            this.router.navigate(['home']);
          }
        } else {
          console.log(response);
        }
      } catch (error) {
        console.log(error);
        //showToast(`Failed to call the backend API. Check your connectivity and make sure ${api.url} is reachable`, "error");
      }
    }
  }

  public signOut() {
    this.user = null;
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    this.router.navigate(['home']);
  }
}